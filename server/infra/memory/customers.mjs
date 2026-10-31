// Repositorio en memoria del modulo de clientes.
import { randomUUID } from "node:crypto";
import { copy } from "./store.mjs";

export function createAddressRepository() {
  const rows = new Map();
  const of = (userId) => rows.get(userId) ?? rows.set(userId, new Map()).get(userId);
  return {
    async listByUser(userId) { return [...of(userId).values()].map(copy); },
    async create(userId, address) {
      const saved = { id: randomUUID(), ...address };
      of(userId).set(saved.id, saved);
      return copy(saved);
    },
    async delete(userId, id) { return of(userId).delete(id); },
  };
}
