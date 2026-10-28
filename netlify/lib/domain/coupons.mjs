// Reglas de cupones. Los cupones viven solo en el servidor (T02): el cliente envia un codigo,
// nunca un descuento. Importes en centavos enteros.
import { ValidationError } from "./errors.mjs";
import * as v from "./validate.mjs";

export const COUPON_TYPES = Object.freeze(["percent", "fixed", "shipping"]);

export const COUPON_TYPE_LABELS = Object.freeze({
  percent: "Porcentaje",
  fixed: "Monto fijo",
  shipping: "Envío gratis",
});

export const normalizeCouponCode = (raw) => v.str(raw, "cupón", { max: 30 }).toUpperCase();

const formatQ = (cents) => `Q${(cents / 100).toFixed(2)}`;

/** Verifica vigencia, cupo, minimo de compra y uso unico. Lanza ValidationError si no aplica. */
export function assertCouponUsable(coupon, { subtotal, alreadyRedeemed = false, now = Date.now() }) {
  if (!coupon || !coupon.active) throw new ValidationError("Cupón inválido");
  if (coupon.startsAt && now < Date.parse(coupon.startsAt)) throw new ValidationError("El cupón todavía no está vigente");
  if (coupon.endsAt && now > Date.parse(coupon.endsAt)) throw new ValidationError("El cupón ya venció");
  if (coupon.maxUses !== null && coupon.maxUses !== undefined && coupon.uses >= coupon.maxUses) {
    throw new ValidationError("El cupón ya alcanzó su límite de usos");
  }
  if (subtotal < coupon.minSubtotal) {
    throw new ValidationError(`El cupón requiere un subtotal mínimo de ${formatQ(coupon.minSubtotal)}`);
  }
  if (coupon.oncePerUser && alreadyRedeemed) throw new ValidationError("Ya utilizaste este cupón");
}

/** Efecto del cupon sobre el subtotal y el envio. */
export function applyCoupon(coupon, { subtotal, shipping }) {
  switch (coupon.type) {
    case "percent":
      return { discount: Math.floor((subtotal * coupon.value) / 100), shipping };
    case "fixed":
      return { discount: Math.min(coupon.value, subtotal), shipping };
    case "shipping":
      return { discount: 0, shipping: 0 };
    default:
      throw new ValidationError("Cupón inválido");
  }
}

/** Valida los datos de un cupon que llegan del panel (creacion o edicion parcial). */
export function parseCouponInput(body, { partial = false } = {}) {
  const out = {};
  const has = (key) => !partial || body[key] !== undefined;
  if (!partial) out.code = v.str(body.code, "código", { min: 3, max: 30, pattern: /^[A-Za-z0-9_-]+$/ }).toUpperCase();
  if (has("label")) out.label = v.str(body.label, "descripción", { min: 3, max: 80 });
  if (has("type")) out.type = v.oneOf(body.type, "tipo", COUPON_TYPES);
  if (has("value")) out.value = v.int(body.value ?? 0, "valor", { min: 0, max: 10_000_000 });
  if (has("minSubtotal")) out.minSubtotal = v.int(body.minSubtotal ?? 0, "subtotal mínimo", { min: 0, max: 10_000_000 });
  if (has("oncePerUser")) out.oncePerUser = v.bool(body.oncePerUser ?? false, "uso único");
  if (has("active")) out.active = v.bool(body.active ?? true, "activo");
  if (has("maxUses")) out.maxUses = body.maxUses === null || body.maxUses === "" || body.maxUses === undefined ? null : v.int(body.maxUses, "usos máximos", { min: 1, max: 1_000_000 });
  if (has("startsAt")) out.startsAt = v.isoDate(body.startsAt, "inicio");
  if (has("endsAt")) out.endsAt = v.isoDate(body.endsAt, "fin");
  assertCouponCoherent(out);
  return out;
}

function assertCouponCoherent(c) {
  if (c.type === "percent" && c.value !== undefined && (c.value < 1 || c.value > 100)) {
    throw new ValidationError("Un descuento porcentual debe estar entre 1 y 100", { field: "valor" });
  }
  if (c.type === "fixed" && c.value !== undefined && c.value < 100) {
    throw new ValidationError("Un descuento fijo debe ser de al menos Q1.00", { field: "valor" });
  }
  if (c.startsAt && c.endsAt && Date.parse(c.startsAt) >= Date.parse(c.endsAt)) {
    throw new ValidationError("La fecha de fin debe ser posterior a la de inicio", { field: "fin" });
  }
}
