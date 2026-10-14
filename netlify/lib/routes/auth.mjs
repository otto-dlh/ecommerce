import { randomUUID } from "node:crypto";
import { HttpError } from "../http.mjs";
import { getJSON, putJSON, mutateJSON, del, store, listJSON } from "../store.mjs";
import * as v from "../validate.mjs";
import {
  hashPassword, verifyPassword, dummyVerify, sha256, randomToken, newTotpSecret, matchTotp,
} from "../crypto.mjs";
import { createSession, destroySession, publicUser, revokeUserSessions, getUser } from "../auth.mjs";
import { rateLimit, assertBelowLimit, recordFailure } from "../ratelimit.mjs";
import { audit, maskEmail } from "../audit.mjs";

const MFA_PENDING_MS = 5 * 60 * 1000;
const GENERIC_LOGIN_ERROR = "Correo o contraseña incorrectos";

async function findUserByEmail(email) {
  const idx = await getJSON("users", `email/${sha256(email)}`);
  return idx ? getUser(idx.id) : null;
}

/** Verifica un codigo TOTP y evita su reutilizacion (anti-replay). */
async function consumeTotp(user, code, secretField = "secret") {
  let ok = false;
  await mutateJSON("users", `u/${user.id}`, (u) => {
    ok = false;
    const secret = u.mfa?.[secretField];
    if (!secret) return undefined;
    const counter = matchTotp(secret, code);
    if (counter === null || counter <= (u.mfa.lastCounter ?? -1)) return undefined;
    ok = true;
    return { ...u, mfa: { ...u.mfa, lastCounter: counter } };
  });
  return ok;
}

export default function authRoutes(add) {
  add("GET", "/api/auth/me", {}, async (ctx) => ({
    user: publicUser(ctx.user),
    csrf: ctx.session?.csrf ?? null,
  }));

  add("POST", "/api/auth/register", {}, async (ctx) => {
    await rateLimit(ctx, "register", ctx.ip, 5, 3600);
    const name = v.str(ctx.body.name, "nombre", { min: 2, max: 80 });
    const email = v.email(ctx.body.email);
    const password = v.password(ctx.body.password);
    const id = randomUUID();
    // Indice de correo con onlyIfNew: unicidad atomica incluso con registros simultaneos
    const idx = await putJSON("users", `email/${sha256(email)}`, { id }, { onlyIfNew: true });
    if (!idx.modified) {
      await audit(ctx, "auth.register", { outcome: "denied", details: { email: maskEmail(email), reason: "duplicado" } });
      throw new HttpError(400, "No fue posible completar el registro con esos datos");
    }
    // El rol siempre es "cliente": cualquier campo "role" enviado se ignora
    const user = {
      id, email, name, role: "cliente", active: true, createdAt: new Date().toISOString(),
      passwordHash: await hashPassword(password), mfa: { enabled: false }, couponsUsed: [],
    };
    await putJSON("users", `u/${id}`, user);
    const csrf = await createSession(ctx, user);
    await audit(ctx, "auth.register", { target: id });
    ctx.status = 201;
    return { user: publicUser(user), csrf };
  });

  add("POST", "/api/auth/login", {}, async (ctx) => {
    const email = v.email(ctx.body.email);
    const password = typeof ctx.body.password === "string" ? ctx.body.password.slice(0, 128) : "";
    // Antiautomatizacion (ASVS v5.0.0-6.3.1): limite de solicitudes por IP y limite de
    // intentos FALLIDOS por IP+cuenta (5/15 min) y por cuenta desde cualquier IP (20/15 min,
    // contra credential stuffing distribuido). Los logins correctos no consumen el cupo.
    await rateLimit(ctx, "login-ip", ctx.ip, 30, 900);
    await assertBelowLimit(ctx, "login-fail-acct", `${ctx.ip}|${email}`, 5);
    await assertBelowLimit(ctx, "login-fail-global", email, 20);

    const user = await findUserByEmail(email);
    const ok = user && user.active ? await verifyPassword(password, user.passwordHash) : await dummyVerify(password);
    if (!ok) {
      await recordFailure("login-fail-acct", `${ctx.ip}|${email}`, 900);
      await recordFailure("login-fail-global", email, 900);
      await audit(ctx, "auth.login", { outcome: "failure", details: { email: maskEmail(email) } });
      throw new HttpError(401, GENERIC_LOGIN_ERROR);
    }
    if (user.mfa?.enabled) {
      const mfaToken = randomToken();
      await putJSON("mfa-pending", sha256(mfaToken), { userId: user.id, exp: Date.now() + MFA_PENDING_MS, attempts: 0 });
      await audit(ctx, "auth.login.mfa_challenge", { target: user.id });
      return { mfaRequired: true, mfaToken };
    }
    const csrf = await createSession(ctx, user);
    await audit(ctx, "auth.login", { target: user.id });
    return { user: publicUser(user), csrf };
  });

  add("POST", "/api/auth/mfa/verify", {}, async (ctx) => {
    await rateLimit(ctx, "mfa-ip", ctx.ip, 20, 900);
    const token = v.str(ctx.body.mfaToken, "mfaToken", { max: 64 });
    const code = v.str(ctx.body.code, "code", { min: 6, max: 6, pattern: /^\d{6}$/ });
    const key = sha256(token);
    let pending = null;
    await mutateJSON("mfa-pending", key, (p) => {
      pending = p;
      return { ...p, attempts: p.attempts + 1 };
    });
    if (!pending || pending.exp < Date.now() || pending.attempts >= 5) {
      if (pending) await del("mfa-pending", key);
      throw new HttpError(401, "El desafío MFA expiró. Inicia sesión de nuevo.");
    }
    const user = await getUser(pending.userId);
    if (!user?.active || !(await consumeTotp(user, code))) {
      await audit(ctx, "auth.mfa", { outcome: "failure", target: pending.userId });
      throw new HttpError(401, "Código incorrecto");
    }
    await del("mfa-pending", key);
    const csrf = await createSession(ctx, user);
    await audit(ctx, "auth.login", { target: user.id, details: { mfa: true } });
    return { user: publicUser(user), csrf };
  });

  add("POST", "/api/auth/logout", { auth: true }, async (ctx) => {
    await audit(ctx, "auth.logout", { target: ctx.user.id });
    await destroySession(ctx);
    return { ok: true };
  });

  add("POST", "/api/auth/logout-all", { auth: true }, async (ctx) => {
    const n = await revokeUserSessions(ctx.user.id);
    await audit(ctx, "auth.logout_all", { target: ctx.user.id, details: { sesiones: n } });
    await destroySession(ctx);
    return { ok: true, revoked: n };
  });

  add("POST", "/api/auth/password", { auth: true }, async (ctx) => {
    await rateLimit(ctx, "password", ctx.user.id, 5, 900);
    const current = typeof ctx.body.current === "string" ? ctx.body.current : "";
    const next = v.password(ctx.body.next, "next");
    if (!(await verifyPassword(current, ctx.user.passwordHash))) {
      await audit(ctx, "auth.password_change", { outcome: "failure" });
      throw new HttpError(400, "La contraseña actual no es correcta");
    }
    const passwordHash = await hashPassword(next);
    const user = await mutateJSON("users", `u/${ctx.user.id}`, (u) => ({ ...u, passwordHash }));
    await revokeUserSessions(user.id);
    const csrf = await createSession(ctx, user);
    await audit(ctx, "auth.password_change", { target: user.id });
    return { ok: true, csrf };
  });

  add("POST", "/api/auth/mfa/setup", { auth: true }, async (ctx) => {
    if (ctx.user.mfa?.enabled) throw new HttpError(400, "MFA ya está activo");
    const secret = newTotpSecret();
    await mutateJSON("users", `u/${ctx.user.id}`, (u) => ({ ...u, mfa: { ...u.mfa, pendingSecret: secret } }));
    const label = encodeURIComponent(`TiendaSegura:${ctx.user.email}`);
    return { secret, otpauth: `otpauth://totp/${label}?secret=${secret}&issuer=TiendaSegura&digits=6&period=30` };
  });

  add("POST", "/api/auth/mfa/enable", { auth: true }, async (ctx) => {
    const code = v.str(ctx.body.code, "code", { min: 6, max: 6, pattern: /^\d{6}$/ });
    if (!(await consumeTotp(ctx.user, code, "pendingSecret"))) throw new HttpError(400, "Código incorrecto");
    await mutateJSON("users", `u/${ctx.user.id}`, (u) => ({
      ...u, mfa: { enabled: true, secret: u.mfa.pendingSecret, lastCounter: u.mfa.lastCounter },
    }));
    await revokeUserSessions(ctx.user.id, ctx.session.key);
    await audit(ctx, "auth.mfa_enabled", { target: ctx.user.id });
    return { ok: true };
  });

  add("POST", "/api/auth/mfa/disable", { auth: true }, async (ctx) => {
    const password = typeof ctx.body.password === "string" ? ctx.body.password : "";
    const code = v.str(ctx.body.code, "code", { min: 6, max: 6, pattern: /^\d{6}$/ });
    if (!(await verifyPassword(password, ctx.user.passwordHash)) || !(await consumeTotp(ctx.user, code))) {
      await audit(ctx, "auth.mfa_disabled", { outcome: "failure" });
      throw new HttpError(400, "Contraseña o código incorrectos");
    }
    await mutateJSON("users", `u/${ctx.user.id}`, (u) => ({ ...u, mfa: { enabled: false } }));
    await audit(ctx, "auth.mfa_disabled", { target: ctx.user.id });
    return { ok: true };
  });

  // Direcciones del cliente: la clave incluye el userId, por lo que solo el titular
  // puede leer o borrar las suyas (ASVS v5.0.0-8.2.2, T04)
  add("GET", "/api/addresses", { auth: true }, async (ctx) => {
    return { addresses: await listJSON("addresses", `${ctx.user.id}/`) };
  });

  add("POST", "/api/addresses", { auth: true }, async (ctx) => {
    const address = parseAddress(ctx.body);
    const id = randomUUID();
    await putJSON("addresses", `${ctx.user.id}/${id}`, { id, ...address });
    ctx.status = 201;
    return { address: { id, ...address } };
  });

  add("DELETE", "/api/addresses/:id", { auth: true }, async (ctx) => {
    const id = v.id(ctx.params.id);
    const key = `${ctx.user.id}/${id}`;
    if (!(await getJSON("addresses", key))) {
      await audit(ctx, "authz.denied", { outcome: "denied", target: `address:${id}` });
      throw new HttpError(404, "Dirección no encontrada");
    }
    await store("addresses").delete(key);
    return { ok: true };
  });
}

export function parseAddress(b = {}) {
  return {
    name: v.str(b.name, "nombre", { min: 2, max: 80 }),
    line1: v.str(b.line1, "dirección", { min: 5, max: 160 }),
    city: v.str(b.city, "ciudad", { min: 2, max: 60 }),
    phone: v.str(b.phone, "teléfono", { min: 8, max: 20, pattern: /^[0-9+\-\s()]+$/ }),
  };
}
