// Repositorios en memoria del modulo de ventas (el pedido descuenta stock sin awaits intermedios: atomico).
import { integrityErrors } from "../../shared/domain/errors.mjs";
import { copy, newestFirst, createKeyedRepository } from "./store.mjs";

export function createCouponRepository() {
  const base = createKeyedRepository((c) => c.code, "Ya existe un cupón con ese código");
  const redemptions = new Map(); // "codigo|pedido" → usuario
  return {
    list: base.list,
    findByCode: base.find,
    create: base.create,
    update: base.update,
    async hasRedeemed(userId, code) { return [...redemptions].some(([key, user]) => user === userId && key.startsWith(`${code}|`)); },
    async redeem({ code, userId, orderId }) {
      const key = `${code}|${orderId}`;
      if (redemptions.has(key)) return false;
      redemptions.set(key, userId);
      const coupon = base.rows.get(code);
      if (coupon) coupon.uses = (coupon.uses ?? 0) + 1;
      return true;
    },
  };
}

export function createOrderRepository(products) {
  const rows = new Map();

  function assertReservable(order) {
    for (const line of order.items) {
      const product = products.rows.get(line.productId);
      if (!product || !product.active) throw integrityErrors.productUnavailable(line.name);
      if (product.price !== line.unitPrice) throw integrityErrors.priceChanged();
      if (product.stock < line.qty) throw integrityErrors.outOfStock(line.name);
    }
  }

  const moveStock = (order, sign) => {
    for (const line of order.items) {
      const product = products.rows.get(line.productId);
      if (product) product.stock += sign * line.qty;
    }
  };

  return {
    async placeOrder(order) {
      if (rows.has(order.id)) throw integrityErrors.orderExists();
      assertReservable(order);
      moveStock(order, -1);
      rows.set(order.id, copy(order));
      return copy(order);
    },
    async findById(id) { return copy(rows.get(id) ?? null); },
    async listByUser(userId) { return [...rows.values()].filter((o) => o.userId === userId).sort(newestFirst("createdAt")).map(copy); },
    async list({ status } = {}) { return [...rows.values()].filter((o) => !status || o.status === status).sort(newestFirst("createdAt")).map(copy); },
    async listOverdue(nowIso) {
      return [...rows.values()].filter((o) => o.status === "pendiente_pago" && o.expiresAt && o.expiresAt <= nowIso).map(copy);
    },
    async updateStatus(id, { from, to, by, patch = {}, releaseStock = false }) {
      const order = rows.get(id);
      if (!order) throw integrityErrors.orderNotFound();
      if (!from.includes(order.status)) throw integrityErrors.transitionNotAllowed(order.status, to);
      const previous = order.status;
      Object.assign(order, copy(patch), { status: to });
      order.history.push({ status: to, at: new Date().toISOString(), by });
      if (releaseStock) moveStock(order, +1);
      return { order: copy(order), from: previous };
    },
  };
}

export function createPaymentEventRepository() {
  const seen = new Set();
  return {
    async registerOnce(eventId) {
      if (seen.has(eventId)) return false;
      seen.add(eventId);
      return true;
    },
  };
}
