// Administracion de cupones. El codigo es inmutable; el resto se edita con las mismas reglas del dominio.
import { ConflictError, NotFoundError, ValidationError } from "../domain/errors.mjs";
import { parseCouponInput, normalizeCouponCode } from "../domain/coupons.mjs";

export function createCouponAdminService({ coupons, audit, events }) {
  const listAll = () => coupons.list();

  async function create(ctx, body) {
    const data = parseCouponInput(body);
    let coupon;
    try {
      coupon = await coupons.create({ maxUses: null, startsAt: null, endsAt: null, ...data, uses: 0 });
    } catch (err) {
      if (err instanceof ConflictError) throw new ConflictError("Ya existe un cupón con ese código");
      throw err;
    }
    await audit.record(ctx, "coupon.create", { target: `coupon:${coupon.code}` });
    await events.emit("coupon.changed", { code: coupon.code });
    return coupon;
  }

  async function update(ctx, rawCode, body) {
    const code = normalizeCouponCode(rawCode);
    const current = await coupons.findByCode(code);
    if (!current) throw new NotFoundError("Cupón no encontrado");
    const changes = parseCouponInput(body, { partial: true });
    // La coherencia (tipo/valor, fechas) se valida sobre el cupon resultante, no solo sobre el cambio
    parseCouponInput({ ...current, ...changes });
    if (changes.maxUses !== undefined && changes.maxUses !== null && changes.maxUses < current.uses) {
      throw new ValidationError(`El cupón ya se usó ${current.uses} veces; el máximo no puede ser menor`);
    }
    const coupon = await coupons.update(code, changes);
    await audit.record(ctx, "coupon.update", { target: `coupon:${code}`, details: changes });
    await events.emit("coupon.changed", { code });
    return coupon;
  }

  return { listAll, create, update };
}
