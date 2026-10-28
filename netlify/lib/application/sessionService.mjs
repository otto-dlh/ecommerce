// Sesiones del lado servidor (ASVS v5.0.0-7.x).
// - Token aleatorio de 256 bits; solo se guarda su SHA-256 (una fuga del almacen no permite secuestrarlas).
// - Expiracion por inactividad y absoluta segun la politica vigente; rotacion al iniciar sesion.
// - Cada sesion tiene un canal realtime privado con un id aleatorio distinto del token.
import { randomToken, sha256 } from "../security/crypto.mjs";
import { maskIp, summarizeUserAgent } from "../domain/masking.mjs";
import { sessionIdleMs, sessionMaxMs } from "../domain/accessPolicy.mjs";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const TOUCH_INTERVAL_MS = 60_000;

/** Nombre del canal realtime privado de una sesion. */
export const privateChannel = (rtChannel) => `s:${rtChannel}`;

const isExpired = (session, policy, now) =>
  now - Date.parse(session.lastSeen) > sessionIdleMs(policy) || now - Date.parse(session.createdAt) > sessionMaxMs(policy);

export function createSessionService({ sessions, users, policy, events }) {
  /** Crea una sesion nueva (y descarta la actual: nunca se reutiliza un identificador). */
  async function open(ctx, user) {
    if (ctx.session) await sessions.delete(ctx.session.keyHash);
    const token = randomToken();
    const now = new Date().toISOString();
    const session = {
      keyHash: sha256(token),
      userId: user.id,
      role: user.role,
      csrf: randomToken(),
      rtChannel: randomToken(16),
      createdAt: now,
      lastSeen: now,
      ipMasked: maskIp(ctx.ip),
      userAgent: summarizeUserAgent(ctx.userAgent),
    };
    await sessions.create(session);
    await events.emit("session.started", { userId: user.id, rtChannel: session.rtChannel, device: session.userAgent, ip: session.ipMasked });
    return { token, session };
  }

  /** Valida el token de la cookie; devuelve la sesion y su usuario o null. */
  async function resolve(token) {
    if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) return null;
    const keyHash = sha256(token);
    const session = await sessions.findByKeyHash(keyHash);
    if (!session) return null;
    const now = Date.now();
    if (isExpired(session, await policy.get(), now)) {
      await sessions.delete(keyHash);
      return null;
    }
    const user = await users.findById(session.userId);
    if (!user || !user.active || user.role !== session.role) {
      await sessions.delete(keyHash);
      return null;
    }
    if (now - Date.parse(session.lastSeen) > TOUCH_INTERVAL_MS) {
      session.lastSeen = new Date(now).toISOString();
      await sessions.touch(keyHash, session.lastSeen);
    }
    return { session, user };
  }

  const close = (session) => sessions.delete(session.keyHash);

  async function announceRevoked(revoked, reason) {
    if (revoked.length === 0) return;
    await events.emit("session.revoked", { channels: revoked.map((s) => privateChannel(s.rtChannel)), userIds: [...new Set(revoked.map((s) => s.userId))], reason });
  }

  /** Revoca todas las sesiones de un usuario (cambio de rol, contrasena, desactivacion...). */
  async function revokeUser(userId, { exceptKeyHash, reason = "revoked" } = {}) {
    const revoked = (await sessions.list({ userId })).filter((s) => s.keyHash !== exceptKeyHash);
    const count = await sessions.deleteByUser(userId, { exceptKeyHash });
    await announceRevoked(revoked, reason);
    return count;
  }

  /** Revoca una sesion concreta (cierre remoto desde el panel). */
  async function revokeOne(keyHash, reason = "closed_by_admin") {
    const session = await sessions.findByKeyHash(keyHash);
    if (!session) return null;
    await sessions.delete(keyHash);
    await announceRevoked([session], reason);
    return session;
  }

  /** Sesiones vigentes segun la politica actual (las vencidas se omiten). */
  async function listActive(filter = {}) {
    const current = await policy.get();
    const now = Date.now();
    return (await sessions.list(filter)).filter((s) => !isExpired(s, current, now));
  }

  /** Limpieza de sesiones vencidas (mantiene pequeno el almacen y la tabla del canal realtime). */
  async function purgeExpired() {
    const current = await policy.get();
    const now = Date.now();
    return sessions.deleteExpired({
      idleBefore: new Date(now - sessionIdleMs(current)).toISOString(),
      createdBefore: new Date(now - sessionMaxMs(current)).toISOString(),
    });
  }

  return { open, resolve, close, revokeUser, revokeOne, listActive, purgeExpired };
}
