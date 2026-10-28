// Controladores de la tienda: catalogo, carrito, pedidos, direcciones y resenas.

export function registerShopRoutes({ add }, { catalog, pricing, checkout, orders, addresses, reviews }) {
  // ---- Catalogo publico ----
  add("GET", "/api/products", {}, async (ctx) => ({ products: await catalog.listProducts(ctx.query) }));
  add("GET", "/api/products/:id", {}, (ctx) => catalog.getProduct(ctx.params.id));
  add("GET", "/api/categories", {}, async () => ({ categories: await catalog.listCategories() }));
  add("GET", "/api/coupons", {}, async () => ({ coupons: await pricing.listPublicCoupons() }));

  // Cotizacion: el frontend muestra siempre los importes que calcula el servidor
  add("POST", "/api/cart/quote", {}, (ctx) => pricing.quote(ctx.user, ctx.body.items, ctx.body.coupon || null));

  // ---- Resenas ----
  add("POST", "/api/products/:id/reviews", { auth: true }, async (ctx) => {
    const review = await reviews.create(ctx, ctx.params.id, ctx.body);
    ctx.status = 201;
    return { review };
  });

  // ---- Pedidos del cliente ----
  add("POST", "/api/orders", { auth: true }, async (ctx) => {
    const order = await checkout.placeOrder(ctx, ctx.body);
    ctx.status = 201;
    return { order };
  });
  add("GET", "/api/orders", { auth: true }, async (ctx) => ({ orders: await orders.listMine(ctx.user) }));
  add("GET", "/api/orders/:id", { auth: true }, async (ctx) => ({ order: await orders.getForActor(ctx, ctx.params.id) }));
  add("POST", "/api/orders/:id/cancel", { auth: true }, async (ctx) => ({ order: await orders.cancelMine(ctx, ctx.params.id) }));

  // ---- Direcciones guardadas ----
  add("GET", "/api/addresses", { auth: true }, async (ctx) => ({ addresses: await addresses.list(ctx.user) }));
  add("POST", "/api/addresses", { auth: true }, async (ctx) => {
    const address = await addresses.create(ctx.user, ctx.body);
    ctx.status = 201;
    return { address };
  });
  add("DELETE", "/api/addresses/:id", { auth: true }, async (ctx) => {
    await addresses.remove(ctx, ctx.params.id);
    return { ok: true };
  });
}
