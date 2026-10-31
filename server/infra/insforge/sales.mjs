// Repositorios del modulo de ventas sobre PostgreSQL de InsForge: cupones, pedidos y eventos de pago.
// Las escrituras de pedidos van por funciones transaccionales del esquema (todo o nada).
import { ConflictError } from "../../shared/domain/errors.mjs";
import { toIso, pickColumns, withDuplicateMessage } from "./db.mjs";

const COUPON_FIELDS = {
  code: "code", label: "label", type: "type", value: "value", minSubtotal: "min_subtotal", oncePerUser: "once_per_user",
  active: "active", maxUses: "max_uses", uses: "uses", startsAt: "starts_at", endsAt: "ends_at",
};

const couponFromRow = (row) =>
  row && {
    code: row.code,
    label: row.label,
    type: row.type,
    value: row.value,
    minSubtotal: row.min_subtotal,
    oncePerUser: row.once_per_user,
    active: row.active,
    maxUses: row.max_uses,
    uses: row.uses,
    startsAt: toIso(row.starts_at),
    endsAt: toIso(row.ends_at),
  };

export function createCouponRepository(db) {
  const coupons = () => db.from("coupons");
  return {
    async list() { return (await db.run(coupons().select("*").order("code"))).map(couponFromRow); },
    async findByCode(code) { return couponFromRow(await db.run(coupons().select("*").eq("code", code).maybeSingle())); },
    async create(coupon) {
      return withDuplicateMessage(async () => couponFromRow(await db.run(coupons().insert([pickColumns(coupon, COUPON_FIELDS)]).select().single())), "Ya existe un cupón con ese código");
    },
    async update(code, changes) {
      return couponFromRow(await db.run(coupons().update(pickColumns(changes, COUPON_FIELDS)).eq("code", code).select().maybeSingle()));
    },
    async hasRedeemed(userId, code) {
      const rows = await db.run(db.from("coupon_redemptions").select("order_id").eq("user_id", userId).eq("code", code).limit(1));
      return rows.length > 0;
    },
    async redeem({ code, userId, orderId }) { return Boolean(await db.rpc("redeem_coupon", { p_code: code, p_user_id: userId, p_order_id: orderId })); },
  };
}

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
