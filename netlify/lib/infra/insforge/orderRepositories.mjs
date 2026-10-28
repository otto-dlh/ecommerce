// Repositorios de pedidos, direcciones y eventos de pago sobre PostgreSQL de InsForge.
// Las escrituras de pedidos van por funciones transaccionales del esquema (todo o nada).
import { ConflictError } from "../../domain/errors.mjs";
import { toIso, isUuid } from "./db.mjs";

const ORDER_SELECT = "*, order_items(*), order_history(*)";

const byKey = (key) => (a, b) => a[key] - b[key];

const orderFromRow = (row) =>
  row && {
    id: row.id,
    userId: row.user_id,
    items: [...row.order_items].sort(byKey("line_no")).map((item) => ({
      productId: item.product_id, name: item.name, unitPrice: item.unit_price, qty: item.qty, lineTotal: item.line_total,
    })),
    subtotal: row.subtotal,
    discount: row.discount,
    shipping: row.shipping,
    total: row.total,
    coupon: row.coupon_code,
    address: { name: row.address_name, line1: row.address_line1, city: row.address_city, phone: row.address_phone },
    status: row.status,
    history: [...row.order_history].sort(byKey("seq")).map((h) => ({ status: h.status, at: toIso(h.at), by: h.by })),
    payment: row.payment_ref ? { ref: row.payment_ref, last4: row.payment_last4, brand: row.payment_brand, eventId: row.payment_event_id } : null,
    createdAt: toIso(row.created_at),
    expiresAt: toIso(row.expires_at),
  };

export function createOrderRepository(db) {
  const orders = () => db.from("orders");
  const newestFirst = (query) => query.order("created_at", { ascending: false });
  const findById = async (id) => orderFromRow(await db.run(orders().select(ORDER_SELECT).eq("id", id).maybeSingle()));

  return {
    findById,
    async placeOrder(order) {
      const names = new Map(order.items.map((item) => [item.productId, item.name]));
      await db.rpc("place_order", { p_order: order }, { nameOf: (id) => names.get(id) });
      return findById(order.id);
    },
    async listByUser(userId) { return (await db.run(newestFirst(orders().select(ORDER_SELECT).eq("user_id", userId)))).map(orderFromRow); },
    async list({ status } = {}) {
      let query = newestFirst(orders().select(ORDER_SELECT));
      if (status) query = query.eq("status", status);
      return (await db.run(query)).map(orderFromRow);
    },
    async listOverdue(nowIso) {
      return (await db.run(orders().select(ORDER_SELECT).eq("status", "pendiente_pago").lte("expires_at", nowIso))).map(orderFromRow);
    },
    async updateStatus(id, { from, to, by, patch = {}, releaseStock = false }) {
      const previous = await db.rpc("set_order_status", { p_id: id, p_from: from, p_to: to, p_by: by, p_patch: patch, p_release_stock: releaseStock });
      return { order: await findById(id), from: previous };
    },
  };
}

// ---- Direcciones ----
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

// ---- Idempotencia de pagos ----
export function createPaymentEventRepository(db) {
  return {
    async registerOnce(eventId, { type }) {
      try {
        await db.run(db.from("payment_events").insert([{ event_id: eventId, type }]));
        return true;
      } catch (err) {
        if (err instanceof ConflictError) return false;
        throw err;
      }
    },
  };
}
