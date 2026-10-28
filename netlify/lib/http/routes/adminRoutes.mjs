// Controladores del panel. Cada ruta declara el permiso que exige; el pipeline lo verifica.

export function registerAdminRoutes({ add }, { stats, productAdmin, orders, userAdmin, reviews, audit }) {
  add("GET", "/api/admin/stats", { perm: "stats:read" }, () => stats.summary());

  // ---- Productos e inventario ----
  add("GET", "/api/admin/products", { perm: "inventory:read" }, async () => ({ products: await productAdmin.listAll() }));
  add("POST", "/api/admin/products", { perm: "catalog:write" }, async (ctx) => {
    const product = await productAdmin.create(ctx, ctx.body);
    ctx.status = 201;
    return { product };
  });
  add("PUT", "/api/admin/products/:id", { perm: "catalog:write" }, async (ctx) => ({ product: await productAdmin.update(ctx, ctx.params.id, ctx.body) }));
  add("POST", "/api/admin/products/:id/stock", { perm: "inventory:write" }, async (ctx) => ({ product: await productAdmin.adjustStock(ctx, ctx.params.id, ctx.body) }));

  // ---- Pedidos ----
  add("GET", "/api/admin/orders", { perm: "orders:read" }, () => orders.listAll());
  add("GET", "/api/admin/orders/:id", { perm: "orders:read" }, async (ctx) => ({ order: await orders.getForActor(ctx, ctx.params.id) }));
  add("POST", "/api/admin/orders/:id/status", { perm: "orders:manage" }, async (ctx) => ({ order: await orders.changeStatus(ctx, ctx.params.id, ctx.body) }));

  // ---- Usuarios y roles ----
  add("GET", "/api/admin/users", { perm: "users:read" }, async () => ({ users: await userAdmin.list() }));
  add("PUT", "/api/admin/users/:id", { perm: "users:manage" }, async (ctx) => ({ user: await userAdmin.update(ctx, ctx.params.id, ctx.body) }));

  // ---- Moderacion de resenas ----
  add("GET", "/api/admin/reviews", { perm: "reviews:moderate" }, async (ctx) => {
    const hidden = ctx.query.get("hidden");
    return { reviews: await reviews.listForModeration({ hidden: hidden === null ? undefined : hidden === "true" }) };
  });
  add("POST", "/api/admin/reviews/:id/hide", { perm: "reviews:moderate" }, async (ctx) => ({ review: await reviews.setHidden(ctx, ctx.params.id, true) }));
  add("POST", "/api/admin/reviews/:id/restore", { perm: "reviews:moderate" }, async (ctx) => ({ review: await reviews.setHidden(ctx, ctx.params.id, false) }));

  // ---- Auditoria ----
  add("GET", "/api/admin/audit", { perm: "audit:read" }, async (ctx) => {
    const limit = Math.min(300, Math.max(10, Number(ctx.query.get("limit")) || 150));
    return { entries: await audit.list({ limit }) };
  });
}
