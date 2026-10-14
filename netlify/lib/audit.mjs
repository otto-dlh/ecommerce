// Bitacora de auditoria append-only con HMAC por registro (ASVS v5.0.0-16.3.x / 16.4.2, T03).
// Cada entrada se firma con una clave derivada: si alguien la altera, la verificacion falla.
import { randomUUID } from "node:crypto";
import { store, listKeys } from "./store.mjs";
import { hmacHex, subkey, safeEqual } from "./crypto.mjs";

export function maskEmail(email) {
  if (!email) return null;
  const [u, d] = String(email).split("@");
  return `${u.slice(0, 1)}***@${d ?? ""}`;
}

export function maskIp(ip) {
  if (!ip) return null;
  if (ip.includes(".")) return ip.split(".").slice(0, 3).concat("0").join(".");
  return ip.split(":").slice(0, 3).join(":") + "::";
}

const canonical = ({ mac, ...rest }) => JSON.stringify(rest);

export async function audit(ctx, action, { target = null, details = null, outcome = "ok" } = {}) {
  try {
    const entry = {
      id: randomUUID(),
      at: new Date().toISOString(),
      action,
      outcome,
      actor: ctx?.user ? { id: ctx.user.id, role: ctx.user.role, email: maskEmail(ctx.user.email) } : null,
      ip: maskIp(ctx?.ip),
      target,
      details,
    };
    entry.mac = hmacHex(await subkey("audit"), canonical(entry));
    const key = `${String(Date.now()).padStart(15, "0")}-${entry.id.slice(0, 8)}`;
    await store("audit").setJSON(key, entry, { onlyIfNew: true });
    // Tambien a stdout: los logs de funciones de Netlify se pueden enviar a un SIEM (Log Drains)
    console.log(JSON.stringify({ type: "audit", ...entry }));
  } catch (err) {
    console.error(JSON.stringify({ type: "audit_error", action, message: err.message }));
  }
}

export async function readAudit(limit = 150) {
  const keys = (await listKeys("audit")).sort().reverse().slice(0, limit);
  const st = store("audit");
  const key = await subkey("audit");
  const entries = await Promise.all(keys.map((k) => st.get(k, { type: "json" })));
  return entries.filter(Boolean).map((e) => ({ ...e, integrity: safeEqual(e.mac, hmacHex(key, canonical(e))) }));
}
