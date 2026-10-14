// Logica de negocio de precios, stock y estados de pedido.
import { HttpError } from "./http.mjs";
import { getJSON, mutateJSON } from "./store.mjs";
import * as v from "./validate.mjs";

// Cupones definidos solo en el servidor (T02)
export const COUPONS = {
  BIENVENIDA10: { label: "10 % de descuento en tu primera compra", type: "percent", value: 10, minSubtotal: 10000, oncePerUser: true },
  QUETZAL50: { label: "Q50 de descuento en compras desde Q400", type: "fixed", value: 5000, minSubtotal: 40000 },
  ENVIOGRATIS: { label: "Envío gratis", type: "shipping", minSubtotal: 0 },
};

const SHIPPING = 2500;
const FREE_SHIPPING_FROM = 30000;
export const PAYMENT_WINDOW_MS = 15 * 60 * 1000;

/** Normaliza el carrito: solo productId y qty; cualquier precio enviado por el cliente se ignora. */
export function parseItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) {
    throw new HttpError(400, "El carrito debe tener entre 1 y 20 productos");
  }
  const merged = new Map();
  for (const it of items) {
    const productId = v.id(it?.productId, "productId");
    const qty = v.int(it?.qty, "cantidad", { min: 1, max: 10 });
    merged.set(productId, (merged.get(productId) ?? 0) + qty);
  }
  for (const [pid, qty] of merged) if (qty > 10) throw new HttpError(400, `Máximo 10 unidades por producto (${pid})`);
  return [...merged].map(([productId, qty]) => ({ productId, qty }));
}

/** Calcula importes exclusivamente con datos del servidor (ASVS v5.0.0-2.2.1, T02). */
export async function quote(items, couponCode, user) {
  const lines = [];
  for (const { productId, qty } of items) {
    const p = await getJSON("products", productId);
    if (!p || !p.active) throw new HttpError(400, `Producto no disponible: ${productId}`);
    lines.push({ productId, name: p.name, emoji: p.emoji, image: p.image ?? null, unitPrice: p.price, qty, lineTotal: p.price * qty, available: p.stock });
  }
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  let discount = 0;
  let shipping = subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING;
  let coupon = null;
  if (couponCode) {
    const code = v.str(couponCode, "cupón", { max: 30 }).toUpperCase();
    const c = COUPONS[code];
    if (!c) throw new HttpError(400, "Cupón inválido");
    if (subtotal < c.minSubtotal) throw new HttpError(400, `El cupón requiere un subtotal mínimo de Q${(c.minSubtotal / 100).toFixed(2)}`);
    if (c.oncePerUser && user?.couponsUsed?.includes(code)) throw new HttpError(400, "Ya utilizaste este cupón");
    if (c.type === "percent") discount = Math.floor((subtotal * c.value) / 100);
    if (c.type === "fixed") discount = Math.min(c.value, subtotal);
    if (c.type === "shipping") shipping = 0;
    coupon = { code, label: c.label };
  }
  const total = Math.max(0, subtotal - discount + shipping);
  return { lines, subtotal, discount, shipping, total, coupon, currency: "GTQ" };
}

const adjustStock = (productId, delta) =>
  mutateJSON("products", productId, (p) => {
    if (delta < 0 && !p.active) throw new HttpError(409, `Producto no disponible: ${p.name}`);
    if (p.stock + delta < 0) throw new HttpError(409, `Sin existencias suficientes de "${p.name}"`);
    return { ...p, stock: p.stock + delta, updatedAt: new Date().toISOString() };
  });

/**
 * Reserva stock de varios productos. Cada decremento usa escritura condicional (ETag);
 * si un producto falla se compensan los ya reservados (ASVS v5.0.0-2.3.3 / 2.3.4, T14).
 */
export async function reserveStock(items) {
  const done = [];
  try {
    for (const { productId, qty } of [...items].sort((a, b) => a.productId.localeCompare(b.productId))) {
      const r = await adjustStock(productId, -qty);
      if (!r) throw new HttpError(400, `Producto no disponible: ${productId}`);
      done.push({ productId, qty });
    }
  } catch (err) {
    await Promise.all(done.map((d) => adjustStock(d.productId, d.qty).catch(() => {})));
    throw err;
  }
}

export const releaseStock = (items) => Promise.all(items.map((i) => adjustStock(i.productId, i.qty).catch(() => {})));

// Maquina de estados del pedido (ASVS v5.0.0-2.3.1). "pagado" solo lo asigna el webhook verificado.
export const TRANSITIONS = {
  pendiente_pago: ["cancelado"],
  pagado: ["preparando", "cancelado"],
  preparando: ["enviado"],
  enviado: ["entregado"],
  entregado: [],
  cancelado: [],
};

/** Cambia el estado con control de concurrencia; libera stock si se cancela. */
export async function transition(orderId, to, by) {
  let from = null;
  const order = await mutateJSON("orders", orderId, (o) => {
    from = o.status;
    if (!(TRANSITIONS[o.status] ?? []).includes(to)) {
      throw new HttpError(409, `Transición no permitida: ${o.status} → ${to}`);
    }
    return { ...o, status: to, history: [...o.history, { status: to, at: new Date().toISOString(), by }] };
  });
  if (!order) throw new HttpError(404, "Pedido no encontrado");
  if (to === "cancelado") await releaseStock(order.items);
  return { order, from };
}

/** Cancela pedidos cuya ventana de pago expiro (libera stock reservado). */
export async function expireIfNeeded(order) {
  if (order.status !== "pendiente_pago" || Date.now() < Date.parse(order.expiresAt)) return order;
  try {
    const { order: o } = await transition(order.id, "cancelado", "sistema:expiracion");
    return o;
  } catch {
    return (await getJSON("orders", order.id)) ?? order;
  }
}
