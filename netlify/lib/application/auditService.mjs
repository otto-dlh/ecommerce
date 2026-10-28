// Bitacora de auditoria append-only con HMAC por registro (ASVS v5.0.0-16.3.x / 16.4.2, T03).
// Si alguien altera un registro en la base de datos, la verificacion de integridad lo detecta.
import { randomUUID } from "node:crypto";
import { maskIp } from "../domain/masking.mjs";
import { canonicalJson } from "../security/canonicalJson.mjs";
import { actorOf } from "./context.mjs";

const PURPOSE = "audit";
const signedPart = ({ mac, integrity, ...entry }) => canonicalJson(entry);

export function createAuditService({ auditLog, keyring, events, logger = console }) {
  async function record(ctx, action, { target = null, details = null, outcome = "ok" } = {}) {
    try {
      const facts = {
        id: randomUUID(),
        at: new Date().toISOString(),
        action,
        outcome,
        actor: actorOf(ctx),
        ip: maskIp(ctx?.ip),
        target,
        details,
      };
      const entry = { ...facts, mac: keyring.sign(PURPOSE, signedPart(facts)) };
      await auditLog.append(entry);
      // Tambien a stdout: los logs de funciones se pueden enviar a un SIEM
      logger.log(JSON.stringify({ type: "audit", ...entry }));
      // Al bus van los hechos y la sesion de origen (para las alertas por rol);
      // al navegador solo llega lo que cada suscriptor decida publicar.
      await events.emit("audit.recorded", { ...facts, originRtChannel: ctx?.session?.rtChannel ?? null });
    } catch (err) {
      // La auditoria nunca debe tumbar la operacion principal, pero el fallo queda en el log
      logger.error(JSON.stringify({ type: "audit_error", action, message: err.message }));
    }
  }

  /** Registros recientes con su verificacion de integridad. */
  async function list({ limit = 150, since } = {}) {
    const entries = await auditLog.list({ limit, since });
    return entries.map((entry) => ({ ...entry, integrity: keyring.verify(PURPOSE, signedPart(entry), entry.mac) }));
  }

  return { record, list };
}
