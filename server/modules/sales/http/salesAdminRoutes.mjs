// Controladores de ventas en el panel: pedidos (maquina de estados) y cupones.

const created = (ctx, key, value) => {
  ctx.status = 201;
  return { [key]: value };
};

export function registerSalesAdminRoutes({ add }, { orders, couponAdmin }) {
  // ---- Pedidos ----
  add("GET", "/api/admin/orders", { perm: "orders:read" }, () => orders.listAll());
  add("GET", "/api/admin/orders/:id", { perm: "orders:read" }, async (ctx) => ({ order: await orders.getForActor(ctx, ctx.params.id) }));
  add("POST", "/api/admin/orders/:id/status", { perm: "orders:manage" }, async (ctx) => ({ order: await orders.changeStatus(ctx, ctx.params.id, ctx.body) }));

  // ---- Cupones ----
  add("GET", "/api/admin/coupons", { perm: "coupons:read" }, async () => ({ coupons: await couponAdmin.listAll() }));
  add("POST", "/api/admin/coupons", { perm: "coupons:write" }, async (ctx) => created(ctx, "coupon", await couponAdmin.create(ctx, ctx.body)));
  add("PUT", "/api/admin/coupons/:code", { perm: "coupons:write" }, async (ctx) => ({ coupon: await couponAdmin.update(ctx, ctx.params.code, ctx.body) }));
}
