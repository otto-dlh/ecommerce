// Repositorio del modulo de auditoria sobre PostgreSQL de InsForge: bitacora append-only.
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
