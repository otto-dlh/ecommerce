// Cotizacion del carrito: carga precios y cupon del servidor y aplica las reglas del dominio (T02).
import { ValidationError } from "../../../shared/domain/errors.mjs";
import { parseItems, buildQuote, tamperedFields } from "../domain/pricing.mjs";
import { normalizeCouponCode } from "../domain/coupons.mjs";

const isCurrent = (coupon, now = Date.now()) =>
  coupon.active && (!coupon.startsAt || now >= Date.parse(coupon.startsAt)) && (!coupon.endsAt || now <= Date.parse(coupon.endsAt));

export function createPricingService({ products, coupons, audit }) {
  async function loadCoupon(rawCode) {
    const coupon = await coupons.findByCode(normalizeCouponCode(rawCode));
    if (!coupon) throw new ValidationError("Cupón inválido");
    return coupon;
  }

  /**
   * Cotiza con datos del servidor; los precios que envie el navegador nunca se leen.
   * Los dos intentos tipicos contra esta ruta quedan en la bitacora: mandar importes propios
   * (se descartan) y mandar cantidades invalidas (se rechaza la peticion completa).
   * @param {object} ctx   contexto de la solicitud (quien, desde donde)
   * @param {{ items?: unknown, coupon?: string|null }} body
   */
  async function quote(ctx, body = {}) {
    const tampered = tamperedFields(body);
    if (tampered.length) {
      await audit.record(ctx, "quote.tampered", { outcome: "rejected", details: { campos: tampered } });
    }
    let items;
    try {
      items = parseItems(body.items);
    } catch (err) {
      if (err instanceof ValidationError) {
        await audit.record(ctx, "quote.rejected", { outcome: "rejected", details: { motivo: err.message } });
      }
      throw err;
    }
    const user = ctx?.user ?? null;
    const found = await products.findByIds(items.map((item) => item.productId));
    const productsById = new Map(found.map((p) => [p.id, p]));
    const coupon = body.coupon ? await loadCoupon(body.coupon) : null;
    const alreadyRedeemed = Boolean(coupon?.oncePerUser && user && (await coupons.hasRedeemed(user.id, coupon.code)));
    return buildQuote({ items, productsById, coupon, alreadyRedeemed });
  }

  /** Cupones vigentes para mostrar en la tienda (solo codigo y descripcion). */
  async function listPublicCoupons() {
    return (await coupons.list()).filter((c) => isCurrent(c)).map(({ code, label }) => ({ code, label }));
  }

  return { quote, listPublicCoupons };
}
