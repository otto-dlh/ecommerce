// Bitacora en memoria (append-only; `tamper` existe solo para probar la deteccion de alteraciones).
import { copy, newestFirst } from "./store.mjs";

export function createAuditRepository() {
  const entries = [];
  return {
    async append(entry) { entries.push(copy(entry)); },
    async list({ limit = 150, since } = {}) {
      return entries.filter((e) => !since || e.at >= since).sort(newestFirst("at")).slice(0, limit).map(copy);
    },
    /** Solo para pruebas: simula una alteracion directa en la base de datos. */
    tamper(id, changes) { Object.assign(entries.find((e) => e.id === id), changes); },
  };
}
