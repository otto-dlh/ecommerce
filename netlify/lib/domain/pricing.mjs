// Calculo de importes exclusivamente con datos del servidor (ASVS v5.0.0-2.2.1, T02).
// Funciones puras: reciben productos y cupon ya cargados; no conocen la base de datos.
import { ValidationError } from "./errors.mjs";
import * as v from "./validate.mjs";
import { assertCouponUsable, applyCoupon } from "./coupons.mjs";

export const CURRENCY = "GTQ";
export const SHIPPING_FEE = 2500;
export const FREE_SHIPPING_FROM = 30000;
export const MAX_CART_LINES = 20;
export const MAX_UNITS_PER_PRODUCT = 10;

/** Normaliza el carrito: solo productId y qty; cualquier precio enviado por el cliente se ignora. */
export function parseItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_CART_LINES) {
    throw new ValidationError(`El carrito debe tener entre 1 y ${MAX_CART_LINES} productos`);
  }
  const merged = new Map();
  for (const item of items) {
    const productId = v.id(item?.productId, "productId");
    const qty = v.int(item?.qty, "cantidad", { min: 1, max: MAX_UNITS_PER_PRODUCT });
    merged.set(productId, (merged.get(productId) ?? 0) + qty);
  }
  for (const [productId, qty] of merged) {
    if (qty > MAX_UNITS_PER_PRODUCT) throw new ValidationError(`Máximo ${MAX_UNITS_PER_PRODUCT} unidades por producto (${productId})`);
  }
  return [...merged].map(([productId, qty]) => ({ productId, qty }));
}

function buildLine({ productId, qty }, product) {
  if (!product || !product.active) throw new ValidationError(`Producto no disponible: ${productId}`);
  return {
    productId,
    name: product.name,
    emoji: product.emoji,
    image: product.image ?? null,
    unitPrice: product.price,
    qty,
    lineTotal: product.price * qty,
    available: product.stock,
  };
}

/**
 * Cotiza el carrito.
 * @param {{ items: {productId:string, qty:number}[], productsById: Map<string, object>,
 *           coupon?: object|null, alreadyRedeemed?: boolean, now?: number }} input
 */
export function buildQuote({ items, productsById, coupon = null, alreadyRedeemed = false, now = Date.now() }) {
  const lines = items.map((item) => buildLine(item, productsById.get(item.productId)));
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  let shipping = subtotal >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;
  let discount = 0;
  if (coupon) {
    assertCouponUsable(coupon, { subtotal, alreadyRedeemed, now });
    ({ discount, shipping } = applyCoupon(coupon, { subtotal, shipping }));
  }
  const total = Math.max(0, subtotal - discount + shipping);
  return {
    lines,
    subtotal,
    discount,
    shipping,
    total,
    coupon: coupon ? { code: coupon.code, label: coupon.label } : null,
    currency: CURRENCY,
  };
}
