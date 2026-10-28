// Autenticacion: registro, inicio de sesion con antiautomatizacion, MFA TOTP y cambio de contrasena.
import { randomUUID } from "node:crypto";
import { ConflictError, UnauthenticatedError, ValidationError } from "../domain/errors.mjs";
import * as v from "../domain/validate.mjs";
import { maskEmail, maskIp } from "../domain/masking.mjs";
import { GENERIC_LOGIN_ERROR, selfView } from "../domain/users.mjs";
import { accountWideFailureLimit, IP_LOGIN_ATTEMPTS_PER_WINDOW, lockoutWindowSec } from "../domain/accessPolicy.mjs";
import { hashPassword, verifyPassword, dummyVerify, sha256, randomToken, newTotpSecret, matchTotp } from "../security/crypto.mjs";
import { BUCKETS } from "./rateLimiter.mjs";
import { privateChannel } from "./sessionService.mjs";

const MFA_CHALLENGE_MS = 5 * 60 * 1000;
const MFA_MAX_ATTEMPTS = 5;
const MFA_PURPOSE = "mfa";
const MAX_PASSWORD_INPUT = 128;

const passwordInput = (value) => (typeof value === "string" ? value.slice(0, MAX_PASSWORD_INPUT) : "");
const sixDigitCode = (value) => v.str(value, "code", { min: 6, max: 6, pattern: /^\d{6}$/ });

export function createAuthService({ users, mfaChallenges, sessions, rateLimiter, audit, policy, keyring }) {
  /** Resultado comun de un inicio de sesion exitoso (el controlador pone la cookie con `sessionToken`). */
  async function startSession(ctx, user) {
    const { token, session } = await sessions.open(ctx, user);
    const fresh = (await users.update(user.id, { lastLoginAt: new Date().toISOString() })) ?? user;
    return { user: selfView(fresh), csrf: session.csrf, realtimeChannel: privateChannel(session.rtChannel), sessionToken: token, session };
  }

  /** Verifica un codigo TOTP y evita su reutilizacion (anti-replay). */
  async function consumeTotp(user, code, field = "secret") {
    const encrypted = user.mfa?.[field];
    if (!encrypted) return false;
    const counter = matchTotp(keyring.decrypt(MFA_PURPOSE, encrypted), code);
    return counter !== null && users.advanceMfaCounter(user.id, counter);
  }

  async function register(ctx, body) {
    await rateLimiter.hit(ctx, BUCKETS.REGISTER, ctx.ip, 5, 3600);
    const name = v.str(body.name, "nombre", { min: 2, max: 80 });
    const email = v.email(body.email);
    const password = v.password(body.password);
    const now = new Date().toISOString();
    let user;
    try {
      // El rol siempre es "cliente": cualquier campo "role" enviado se ignora (asignacion masiva)
      user = await users.create({
        id: randomUUID(), email, name, role: "cliente", active: true, passwordHash: await hashPassword(password),
        mfa: { enabled: false }, mustChangePassword: false, createdAt: now, lastLoginAt: null,
      });
    } catch (err) {
      if (!(err instanceof ConflictError)) throw err;
      await audit.record(ctx, "auth.register", { outcome: "denied", details: { email: maskEmail(email), reason: "duplicado" } });
      // Mensaje generico: no confirma que el correo ya este registrado
      throw new ValidationError("No fue posible completar el registro con esos datos");
    }
    await audit.record(ctx, "auth.register", { target: user.id });
    return startSession(ctx, user);
  }

  /** Deja constancia del bloqueo una sola vez: en el fallo que alcanza el limite de la politica. */
  async function recordLockoutIfReached(ctx, { user, email, policy: current, failuresHere, failuresAnywhere }) {
    const scope = failuresHere === current.maxFailedLogins ? "ip+cuenta" : failuresAnywhere === accountWideFailureLimit(current) ? "cuenta" : null;
    if (!scope) return;
    await audit.record(ctx, "auth.lockout", {
      outcome: "denied",
      target: user ? `user:${user.id}` : null,
      details: { cuenta: maskEmail(email), alcance: scope, minutos: current.lockoutMinutes },
    });
  }

  async function login(ctx, body) {
    const email = v.email(body.email);
    const password = passwordInput(body.password);
    const current = await policy.get();
    const windowSec = lockoutWindowSec(current);
    const accountKey = `${ctx.ip}|${email}`;
    // Antiautomatizacion (ASVS v5.0.0-6.3.1): intentos por IP y fallos por IP+cuenta y por cuenta.
    // Los inicios correctos no consumen el cupo de fallos.
    await rateLimiter.hit(ctx, BUCKETS.LOGIN_IP, ctx.ip, IP_LOGIN_ATTEMPTS_PER_WINDOW, windowSec);
    await rateLimiter.assertBelow(ctx, BUCKETS.LOGIN_FAIL_ACCOUNT, accountKey, current.maxFailedLogins);
    await rateLimiter.assertBelow(ctx, BUCKETS.LOGIN_FAIL_GLOBAL, email, accountWideFailureLimit(current));

    const user = await users.findByEmail(email);
    const ok = user && user.active ? await verifyPassword(password, user.passwordHash) : await dummyVerify(password);
    if (!ok) {
      const failuresHere = await rateLimiter.recordFailure(BUCKETS.LOGIN_FAIL_ACCOUNT, accountKey, windowSec, `${maskEmail(email)} · ${maskIp(ctx.ip)}`);
      const failuresAnywhere = await rateLimiter.recordFailure(BUCKETS.LOGIN_FAIL_GLOBAL, email, windowSec, maskEmail(email));
      await audit.record(ctx, "auth.login", { outcome: "failure", details: { email: maskEmail(email) } });
      await recordLockoutIfReached(ctx, { user, email, policy: current, failuresHere, failuresAnywhere });
      throw new UnauthenticatedError(GENERIC_LOGIN_ERROR);
    }
    if (user.mfa?.enabled) {
      const mfaToken = randomToken();
      await mfaChallenges.create({ tokenHash: sha256(mfaToken), userId: user.id, expiresAt: new Date(Date.now() + MFA_CHALLENGE_MS).toISOString() });
      await audit.record(ctx, "auth.login.mfa_challenge", { target: user.id });
      return { mfaRequired: true, mfaToken };
    }
    const result = await startSession(ctx, user);
    await audit.record(ctx, "auth.login", { target: user.id });
    return result;
  }

  async function verifyMfa(ctx, body) {
    await rateLimiter.hit(ctx, BUCKETS.MFA_IP, ctx.ip, 20, 900);
    const tokenHash = sha256(v.str(body.mfaToken, "mfaToken", { max: 64 }));
    const code = sixDigitCode(body.code);
    const challenge = await mfaChallenges.consumeAttempt(tokenHash);
    if (!challenge || Date.parse(challenge.expiresAt) < Date.now() || challenge.attempts >= MFA_MAX_ATTEMPTS) {
      if (challenge) await mfaChallenges.delete(tokenHash);
      throw new UnauthenticatedError("El desafío MFA expiró. Inicia sesión de nuevo.");
    }
    const user = await users.findById(challenge.userId);
    if (!user?.active || !(await consumeTotp(user, code))) {
      await audit.record(ctx, "auth.mfa", { outcome: "failure", target: challenge.userId });
      throw new UnauthenticatedError("Código incorrecto");
    }
    await mfaChallenges.delete(tokenHash);
    const result = await startSession(ctx, user);
    await audit.record(ctx, "auth.login", { target: user.id, details: { mfa: true } });
    return result;
  }

  async function logout(ctx) {
    await audit.record(ctx, "auth.logout", { target: ctx.user.id });
    await sessions.close(ctx.session);
  }

  async function logoutAll(ctx) {
    const revoked = await sessions.revokeUser(ctx.user.id, { reason: "logout_all" });
    await audit.record(ctx, "auth.logout_all", { target: ctx.user.id, details: { sesiones: revoked } });
    return revoked;
  }

  async function changePassword(ctx, body) {
    await rateLimiter.hit(ctx, BUCKETS.PASSWORD, ctx.user.id, 5, 900);
    const next = v.password(body.next, "next");
    if (!(await verifyPassword(passwordInput(body.current), ctx.user.passwordHash))) {
      await audit.record(ctx, "auth.password_change", { outcome: "failure" });
      throw new ValidationError("La contraseña actual no es correcta");
    }
    if (await verifyPassword(next, ctx.user.passwordHash)) throw new ValidationError("La nueva contraseña debe ser distinta de la actual");
    const user = await users.update(ctx.user.id, { passwordHash: await hashPassword(next), mustChangePassword: false });
    // Cambiar la contrasena cierra todas las sesiones y abre una nueva para este dispositivo
    await sessions.revokeUser(user.id, { exceptKeyHash: ctx.session.keyHash, reason: "password_changed" });
    const result = await startSession(ctx, user);
    await audit.record(ctx, "auth.password_change", { target: user.id });
    return result;
  }

  async function startMfaSetup(ctx) {
    if (ctx.user.mfa?.enabled) throw new ValidationError("MFA ya está activo");
    const secret = newTotpSecret();
    await users.update(ctx.user.id, { mfa: { ...ctx.user.mfa, pendingSecret: keyring.encrypt(MFA_PURPOSE, secret) } });
    const label = encodeURIComponent(`TiendaSegura:${ctx.user.email}`);
    return { secret, otpauth: `otpauth://totp/${label}?secret=${secret}&issuer=TiendaSegura&digits=6&period=30` };
  }

  async function enableMfa(ctx, body) {
    const code = sixDigitCode(body.code);
    if (!(await consumeTotp(ctx.user, code, "pendingSecret"))) throw new ValidationError("Código incorrecto");
    const fresh = await users.findById(ctx.user.id);
    await users.update(ctx.user.id, { mfa: { enabled: true, secret: fresh.mfa.pendingSecret, pendingSecret: null, lastCounter: fresh.mfa.lastCounter } });
    await sessions.revokeUser(ctx.user.id, { exceptKeyHash: ctx.session.keyHash, reason: "mfa_enabled" });
    await audit.record(ctx, "auth.mfa_enabled", { target: ctx.user.id });
  }

  async function disableMfa(ctx, body) {
    const code = sixDigitCode(body.code);
    if (!(await verifyPassword(passwordInput(body.password), ctx.user.passwordHash)) || !(await consumeTotp(ctx.user, code))) {
      await audit.record(ctx, "auth.mfa_disabled", { outcome: "failure" });
      throw new ValidationError("Contraseña o código incorrectos");
    }
    await users.update(ctx.user.id, { mfa: { enabled: false, secret: null, pendingSecret: null, lastCounter: null } });
    await audit.record(ctx, "auth.mfa_disabled", { target: ctx.user.id });
  }

  /** Estado de la sesion actual para el frontend. */
  const me = (ctx) => ({
    user: selfView(ctx.user),
    csrf: ctx.session?.csrf ?? null,
    realtimeChannel: ctx.session ? privateChannel(ctx.session.rtChannel) : null,
  });

  return { register, login, verifyMfa, logout, logoutAll, changePassword, startMfaSetup, enableMfa, disableMfa, me };
}
