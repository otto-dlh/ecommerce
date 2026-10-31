// Repositorio del modulo de clientes sobre PostgreSQL de InsForge: direcciones guardadas.
import { isUuid } from "./db.mjs";

const addressFromRow = (row) => ({ id: row.id, name: row.name, line1: row.line1, city: row.city, phone: row.phone });

export function createAddressRepository(db) {
  const addresses = () => db.from("addresses");
  return {
    async listByUser(userId) { return (await db.run(addresses().select("*").eq("user_id", userId).order("created_at"))).map(addressFromRow); },
    async create(userId, { name, line1, city, phone }) {
      return addressFromRow(await db.run(addresses().insert([{ user_id: userId, name, line1, city, phone }]).select().single()));
    },
    async delete(userId, id) {
      if (!isUuid(id)) return false;
      const removed = await db.run(addresses().delete().eq("user_id", userId).eq("id", id).select("id"));
      return removed.length > 0;
    },
  };
}
