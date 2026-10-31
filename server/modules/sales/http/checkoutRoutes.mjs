// Controladores de compra del cliente: cupones vigentes, cotizacion del carrito y pedidos propios.

export function registerCheckoutRoutes({ add }, { pricing, checkout, orders }) {
  add("GET", "/api/coupons", {}, async () => ({ coupons: await pricing.listPublicCoupons() }));

  // Cotizacion: el frontend muestra siempre los importes que calcula el servidor
  add("POST", "/api/cart/quote", {}, (ctx) => pricing.quote(ctx.user, ctx.body.items, ctx.body.coupon || null));

  add("POST", "/api/orders", { auth: true }, async (ctx) => {
    const order = await checkout.placeOrder(ctx, ctx.body);
    ctx.status = 201;
    return { order };
  });
  add("GET", "/api/orders", { auth: true }, async (ctx) => ({ orders: await orders.listMine(ctx.user) }));
  add("GET", "/api/orders/:id", { auth: true }, async (ctx) => ({ order: await orders.getForActor(ctx, ctx.params.id) }));
  add("POST", "/api/orders/:id/cancel", { auth: true }, async (ctx) => ({ order: await orders.cancelMine(ctx, ctx.params.id) }));
}
