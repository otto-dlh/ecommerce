// Cotizacion del carrito: carga precios y cupon del servidor y aplica las reglas del dominio (T02).
import { ValidationError } from "../../../shared/domain/errors.mjs";
import { parseItems, buildQuote } from "../domain/pricing.mjs";
import { normalizeCouponCode } from "../domain/coupons.mjs";

const isCurrent = (coupon, now = Date.now()) =>
  coupon.active && (!coupon.startsAt || now >= Date.parse(coupon.startsAt)) && (!coupon.endsAt || now <= Date.parse(coupon.endsAt));

export function createPricingService({ products, coupons }) {
  async function loadCoupon(rawCode) {
    const coupon = await coupons.findByCode(normalizeCouponCode(rawCode));
    if (!coupon) throw new ValidationError("Cupón inválido");
    return coupon;
  }

  /** Cotiza con datos del servidor; los precios que envie el navegador nunca se leen. */
  async function quote(user, rawItems, rawCouponCode) {
    const items = parseItems(rawItems);
    const found = await products.findByIds(items.map((item) => item.productId));
    const productsById = new Map(found.map((p) => [p.id, p]));
    const coupon = rawCouponCode ? await loadCoupon(rawCouponCode) : null;
    const alreadyRedeemed = Boolean(coupon?.oncePerUser && user && (await coupons.hasRedeemed(user.id, coupon.code)));
    return buildQuote({ items, productsById, coupon, alreadyRedeemed });
  }

  /** Cupones vigentes para mostrar en la tienda (solo codigo y descripcion). */
  async function listPublicCoupons() {
    return (await coupons.list()).filter((c) => isCurrent(c)).map(({ code, label }) => ({ code, label }));
  }

  return { quote, listPublicCoupons };
}
