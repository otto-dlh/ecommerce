// Bitacora, archivos y realtime sobre InsForge.
import { toIso } from "./db.mjs";

const auditFromRow = (row) => ({
  id: row.id,
  at: toIso(row.at),
  action: row.action,
  outcome: row.outcome,
  actor: row.actor,
  ip: row.ip,
  target: row.target,
  details: row.details,
  mac: row.mac,
});

export function createAuditRepository(db) {
  const audit = () => db.from("audit_log");
  return {
    async append(entry) {
      const { id, at, action, outcome, actor, ip, target, details, mac } = entry;
      await db.run(audit().insert([{ id, at, action, outcome, actor, ip, target, details, mac }]));
    },
    async list({ limit = 150, since } = {}) {
      let query = audit().select("*").order("at", { ascending: false }).limit(limit);
      if (since) query = query.gte("at", since);
      return (await db.run(query)).map(auditFromRow);
    },
  };
}

/** Archivos publicos (fotos de producto) en un bucket de InsForge Storage. */
export function createFileStorage(db, bucket) {
  const files = () => db.storage.from(bucket);
  return {
    async put(key, bytes, contentType) {
      const data = await db.run(files().upload(key, new Blob([bytes], { type: contentType })));
      return { key: data.key, url: data.url };
    },
    async remove(key) { await db.run(files().remove(key)); },
  };
}

/** Publica senales en canales realtime mediante una funcion del esquema (solo la API puede llamarla). */
export function createRealtimePublisher(db) {
  return {
    async publish(channels, event, payload) {
      if (channels.length === 0) return;
      await db.rpc("rt_publish_many", { p_channels: channels, p_event: event, p_payload: payload });
    },
  };
}
