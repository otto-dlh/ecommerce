// Controladores publicos del catalogo y de las resenas de clientes.

export function registerStorefrontRoutes({ add }, { catalog, reviews }) {
  add("GET", "/api/products", {}, async (ctx) => ({ products: await catalog.listProducts(ctx.query) }));
  add("GET", "/api/products/:id", {}, (ctx) => catalog.getProduct(ctx.params.id));
  add("GET", "/api/categories", {}, async () => ({ categories: await catalog.listCategories() }));

  add("POST", "/api/products/:id/reviews", { auth: true }, async (ctx) => {
    const review = await reviews.create(ctx, ctx.params.id, ctx.body);
    ctx.status = 201;
    return { review };
  });
}
