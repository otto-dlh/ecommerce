// Administracion del inicio de sesion: sesiones activas, intentos fallidos y bloqueos,
// acciones sobre cuentas y politica de acceso. Cada accion queda auditada.
import { NotFoundError, ValidationError } from "../domain/errors.mjs";
import * as v from "../domain/validate.mjs";
import { maskEmail } from "../domain/masking.mjs";
import { assertNotSelf } from "../domain/users.mjs";
import { ROLE_LABELS } from "../domain/permissions.mjs";
import { POLICY_LIMITS, accountWideFailureLimit } from "../domain/accessPolicy.mjs";
import { hashPassword, randomToken } from "../security/crypto.mjs";
import { BUCKETS } from "./rateLimiter.mjs";

const LOCKOUT_BUCKETS = Object.freeze({
  [BUCKETS.LOGIN_FAIL_ACCOUNT]: "Cuenta desde una IP",
  [BUCKETS.LOGIN_FAIL_GLOBAL]: "Cuenta desde cualquier IP",
});
const WINDOW_KEY = /^[0-9a-f]{40}$/;
const DAY_MS = 24 * 3600 * 1000;

/** Contrasena temporal de 22 caracteres aleatorios (cumple la politica de 12 a 128). */
const temporaryPassword = () => `Tmp-${randomToken(16)}`;

const sessionView = (session, user, currentKeyHash) => ({
  id: session.keyHash,
  user: user ? { id: user.id, name: user.name, email: user.email, role: user.role, roleLabel: ROLE_LABELS[user.role] } : null,
  createdAt: session.createdAt,
  lastSeen: session.lastSeen,
  ip: session.ipMasked,
  device: session.userAgent,
  current: session.keyHash === currentKeyHash,
});

export function createAccessService({ users, sessions, rateLimiter, policy, audit, events }) {
  async function findTarget(rawId) {
    const user = await users.findById(v.id(rawId));
    if (!user) throw new NotFoundError("Usuario no encontrado");
    return user;
  }

  async function announce(kind) {
    await events.emit("access.changed", { kind });
  }

  // ---- Sesiones ----
  async function listSessions(ctx) {
    const active = await sessions.listActive();
    const owners = new Map();
    for (const userId of new Set(active.map((s) => s.userId))) owners.set(userId, await users.findById(userId));
    return active.map((s) => sessionView(s, owners.get(s.userId), ctx.session?.keyHash));
  }

  async function revokeSession(ctx, rawId) {
    const keyHash = v.str(rawId, "sesión", { min: 64, max: 64, pattern: /^[0-9a-f]{64}$/ });
    if (keyHash === ctx.session.keyHash) throw new ValidationError("Para cerrar tu propia sesión usa «Salir»");
    const revoked = await sessions.revokeOne(keyHash, "closed_by_admin");
    if (!revoked) throw new NotFoundError("La sesión ya no existe");
    await audit.record(ctx, "access.session_revoked", { target: `user:${revoked.userId}`, details: { dispositivo: revoked.userAgent } });
    await announce("sessions");
  }

  async function revokeUserSessions(ctx, rawId) {
    const target = await findTarget(rawId);
    assertNotSelf(ctx.user, target.id);
    const count = await sessions.revokeUser(target.id, { reason: "closed_by_admin" });
    await audit.record(ctx, "access.session_revoked", { target: `user:${target.id}`, details: { sesiones: count } });
    await announce("sessions");
    return count;
  }

  // ---- Intentos y bloqueos ----
  async function listLockouts() {
    const current = await policy.get();
    const thresholds = { [BUCKETS.LOGIN_FAIL_ACCOUNT]: current.maxFailedLogins, [BUCKETS.LOGIN_FAIL_GLOBAL]: accountWideFailureLimit(current) };
    const groups = await Promise.all(
      Object.entries(LOCKOUT_BUCKETS).map(async ([bucket, scope]) => {
        const windows = await rateLimiter.listWindows(bucket, 1);
        return windows.map((w) => ({ bucket, scope, key: w.key, label: w.label, failures: w.count, threshold: thresholds[bucket], locked: w.count >= thresholds[bucket], resetAt: w.resetAt }));
      }),
    );
    return groups.flat().sort((a, b) => Number(b.locked) - Number(a.locked) || b.failures - a.failures);
  }

  async function listFailedAttempts() {
    const since = new Date(Date.now() - DAY_MS).toISOString();
    const entries = await audit.list({ since, limit: 500 });
    return entries
      .filter((e) => (e.action === "auth.login" || e.action === "auth.mfa") && e.outcome === "failure")
      .map((e) => ({ at: e.at, account: e.details?.email ?? (e.target ? "cuenta con MFA" : null), ip: e.ip, kind: e.action === "auth.mfa" ? "Código MFA" : "Contraseña" }));
  }

  async function unlock(ctx, body) {
    const bucket = v.oneOf(body.bucket, "tipo de bloqueo", Object.keys(LOCKOUT_BUCKETS));
    const key = v.str(body.key, "clave", { min: 40, max: 40, pattern: WINDOW_KEY });
    await rateLimiter.clearKey(bucket, key);
    await audit.record(ctx, "access.unlock", { target: `lockout:${bucket}`, details: { cuenta: v.str(body.label ?? "", "etiqueta", { optional: true, max: 120 }) || null } });
    await announce("lockouts");
  }

  // ---- Cuentas ----
  async function forcePasswordChange(ctx, rawId) {
    const target = await findTarget(rawId);
    assertNotSelf(ctx.user, target.id);
    const password = temporaryPassword();
    await users.update(target.id, { passwordHash: await hashPassword(password), mustChangePassword: true });
    const revoked = await sessions.revokeUser(target.id, { reason: "password_reset" });
    await audit.record(ctx, "access.force_password", { target: `user:${target.id}`, details: { cuenta: maskEmail(target.email), sesionesRevocadas: revoked } });
    await announce("accounts");
    // Se muestra una sola vez al administrador; nunca se guarda en claro ni se registra
    return { temporaryPassword: password };
  }

  async function resetMfa(ctx, rawId) {
    const target = await findTarget(rawId);
    assertNotSelf(ctx.user, target.id);
    if (!target.mfa?.enabled) throw new ValidationError("La cuenta no tiene MFA activo");
    await users.update(target.id, { mfa: { enabled: false, secret: null, pendingSecret: null, lastCounter: null } });
    const revoked = await sessions.revokeUser(target.id, { reason: "mfa_reset" });
    await audit.record(ctx, "access.mfa_reset", { target: `user:${target.id}`, details: { cuenta: maskEmail(target.email), sesionesRevocadas: revoked } });
    await announce("accounts");
  }

  // ---- Politica ----
  async function getPolicy() {
    return { policy: await policy.get(), limits: POLICY_LIMITS };
  }

  const updatePolicy = (ctx, body) => policy.update(ctx, body);

  async function summary() {
    const [active, lockouts, attempts] = await Promise.all([sessions.listActive(), listLockouts(), listFailedAttempts()]);
    return { activeSessions: active.length, lockedAccounts: lockouts.filter((l) => l.locked).length, failedAttempts24h: attempts.length };
  }

  return { listSessions, revokeSession, revokeUserSessions, listLockouts, listFailedAttempts, unlock, forcePasswordChange, resetMfa, getPolicy, updatePolicy, summary };
}
