// Controladores del catalogo en el panel: productos, inventario, fotos, categorias y moderacion de resenas.
// Cada ruta declara el permiso que exige; el pipeline lo verifica.
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "../domain/images.mjs";

const IMAGE_UPLOAD = { perm: "catalog:write", rawBody: true, maxBodyBytes: MAX_IMAGE_BYTES, contentTypes: ACCEPTED_IMAGE_TYPES };

const created = (ctx, key, value) => {
  ctx.status = 201;
  return { [key]: value };
};

export function registerCatalogAdminRoutes({ add }, { productAdmin, productImages, categoryAdmin, reviews }) {
  // ---- Productos e inventario ----
  add("GET", "/api/admin/products", { perm: "inventory:read" }, async () => ({ products: await productAdmin.listAll() }));
  add("POST", "/api/admin/products", { perm: "catalog:write" }, async (ctx) => created(ctx, "product", await productAdmin.create(ctx, ctx.body)));
  add("PUT", "/api/admin/products/:id", { perm: "catalog:write" }, async (ctx) => ({ product: await productAdmin.update(ctx, ctx.params.id, ctx.body) }));
  add("POST", "/api/admin/products/:id/stock", { perm: "inventory:write" }, async (ctx) => ({ product: await productAdmin.adjustStock(ctx, ctx.params.id, ctx.body) }));

  // ---- Fotos de producto (cuerpo binario, tipo validado por contenido) ----
  add("POST", "/api/admin/products/:id/image", IMAGE_UPLOAD, async (ctx) => ({ product: await productImages.upload(ctx, ctx.params.id, ctx.bytes) }));
  add("DELETE", "/api/admin/products/:id/image", { perm: "catalog:write" }, async (ctx) => ({ product: await productImages.remove(ctx, ctx.params.id) }));

  // ---- Categorias ----
  add("GET", "/api/admin/categories", { perm: "categories:read" }, async () => ({ categories: await categoryAdmin.listAll() }));
  add("POST", "/api/admin/categories", { perm: "categories:write" }, async (ctx) => created(ctx, "category", await categoryAdmin.create(ctx, ctx.body)));
  add("PUT", "/api/admin/categories/:id", { perm: "categories:write" }, async (ctx) => ({ category: await categoryAdmin.update(ctx, ctx.params.id, ctx.body) }));

  // ---- Moderacion de resenas ----
  add("GET", "/api/admin/reviews", { perm: "reviews:moderate" }, async (ctx) => {
    const hidden = ctx.query.get("hidden");
    return { reviews: await reviews.listForModeration({ hidden: hidden === null ? undefined : hidden === "true" }) };
  });
  add("POST", "/api/admin/reviews/:id/hide", { perm: "reviews:moderate" }, async (ctx) => ({ review: await reviews.setHidden(ctx, ctx.params.id, true) }));
  add("POST", "/api/admin/reviews/:id/restore", { perm: "reviews:moderate" }, async (ctx) => ({ review: await reviews.setHidden(ctx, ctx.params.id, false) }));
}
