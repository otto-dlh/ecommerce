// Utilidades del proveedor en memoria: copias defensivas y repositorio generico por clave.
import { ConflictError } from "../../shared/domain/errors.mjs";

export const copy = (value) => (value === null || value === undefined ? value : structuredClone(value));

export const newestFirst = (field) => (a, b) => String(b[field]).localeCompare(String(a[field]));

/** Repositorio generico por clave para entidades simples. */
export function createKeyedRepository(keyOf, duplicateMessage) {
  const rows = new Map();
  return {
    rows,
    async list() { return [...rows.values()].map(copy); },
    async find(key) { return copy(rows.get(key) ?? null); },
    async create(item) {
      if (rows.has(keyOf(item))) throw new ConflictError(duplicateMessage);
      rows.set(keyOf(item), copy(item));
      return copy(item);
    },
    async update(key, changes) {
      const current = rows.get(key);
      if (!current) return null;
      const next = { ...current, ...copy(changes) };
      rows.set(key, next);
      return copy(next);
    },
  };
}
