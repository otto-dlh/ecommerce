// Sesiones del lado servidor y autorizacion por rol/permiso.
// - Token aleatorio de 256 bits, se guarda solo su SHA-256 (una fuga del store no permite secuestrar sesiones).
// - Expiracion por inactividad (30 min) y absoluta (8 h) (ASVS v5.0.0-7.1.1).
// - Rotacion en login y revocacion real en logout (ASVS v5.0.0-7.2.4 / 7.4.1).
import { store, getJSON, listKeys, del } from "./store.mjs";
import { randomToken, sha256 } from "./crypto.mjs";
import { sessionCookie } from "./http.mjs";

export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const SESSION_ABS_MS = 8 * 60 * 60 * 1000;

export const ROLES = ["cliente", "operador", "admin"];

// Permisos explicitos por operacion (ASVS v5.0.0-8.2.1). La autorizacion vive en el backend,
// el frontend solo oculta botones por usabilidad (ASVS v5.0.0-8.3.1).
const PERMS = {
  "catalog:write": ["admin"],
  "inventory:write": ["admin", "operador"],
  "orders:manage": ["admin", "operador"],
  "reviews:moderate": ["admin", "operador"],
  "users:manage": ["admin"],
  "audit:read": ["admin"],
  "stats:read": ["admin", "operador"],
};

export const can = (user, perm) => Boolean(user && PERMS[perm]?.includes(user.role));

export const publicUser = (u) =>
  u && { id: u.id, email: u.email, name: u.name, role: u.role, mfaEnabled: Boolean(u.mfa?.enabled) };

const cookieName = (url) => (url.protocol === "https:" ? "__Host-sid" : "sid");
const isSecure = (url) => url.protocol === "https:";

export const getUser = (id) => getJSON("users", `u/${id}`);

export async function createSession(ctx, user) {
  await destroySession(ctx); // rotacion: nunca se reutiliza un identificador previo
  const token = randomToken();
  const csrf = randomToken();
  const now = Date.now();
  const key = `${user.id}/${sha256(token)}`;
  await store("sessions").setJSON(key, { userId: user.id, createdAt: now, lastSeen: now, csrf });
  ctx.setCookie(sessionCookie(cookieName(ctx.url), `${user.id}.${token}`, SESSION_ABS_MS / 1000, isSecure(ctx.url)));
  ctx.session = { key, userId: user.id, createdAt: now, lastSeen: now, csrf };
  ctx.user = user;
  return csrf;
}

function clearCookie(ctx) {
  ctx.setCookie(sessionCookie(cookieName(ctx.url), "", 0, isSecure(ctx.url)));
}

export async function loadSession(ctx) {
  const raw = ctx.cookies[cookieName(ctx.url)];
  if (!raw) return;
  const m = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/.exec(raw);
  if (!m) return clearCookie(ctx);
  const key = `${m[1]}/${sha256(m[2])}`;
  const s = await getJSON("sessions", key);
  const now = Date.now();
  if (!s || now - s.lastSeen > SESSION_IDLE_MS || now - s.createdAt > SESSION_ABS_MS) {
    if (s) await del("sessions", key);
    return clearCookie(ctx);
  }
  const user = await getUser(s.userId);
  if (!user || !user.active) {
    await del("sessions", key);
    return clearCookie(ctx);
  }
  if (now - s.lastSeen > 60_000) {
    s.lastSeen = now;
    await store("sessions").setJSON(key, s);
  }
  ctx.session = { key, ...s };
  ctx.user = user;
}

export async function destroySession(ctx) {
  if (ctx.session) await del("sessions", ctx.session.key);
  ctx.session = null;
  ctx.user = null;
  clearCookie(ctx);
}

// Revoca todas las sesiones de un usuario (cambio de rol, contrasena, desactivacion)
export async function revokeUserSessions(userId, exceptKey) {
  const keys = await listKeys("sessions", `${userId}/`);
  await Promise.all(keys.filter((k) => k !== exceptKey).map((k) => del("sessions", k)));
  return keys.length;
}
