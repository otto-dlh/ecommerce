// Controladores de catalogo del panel: categorias, cupones, fotos de producto y clientes.
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "../../domain/images.mjs";

const IMAGE_UPLOAD = { perm: "catalog:write", rawBody: true, maxBodyBytes: MAX_IMAGE_BYTES, contentTypes: ACCEPTED_IMAGE_TYPES };

const created = (ctx, key, value) => {
  ctx.status = 201;
  return { [key]: value };
};

export function registerCatalogAdminRoutes({ add }, { categoryAdmin, couponAdmin, productImages, customers }) {
  // ---- Categorias ----
  add("GET", "/api/admin/categories", { perm: "categories:read" }, async () => ({ categories: await categoryAdmin.listAll() }));
  add("POST", "/api/admin/categories", { perm: "categories:write" }, async (ctx) => created(ctx, "category", await categoryAdmin.create(ctx, ctx.body)));
  add("PUT", "/api/admin/categories/:id", { perm: "categories:write" }, async (ctx) => ({ category: await categoryAdmin.update(ctx, ctx.params.id, ctx.body) }));

  // ---- Cupones ----
  add("GET", "/api/admin/coupons", { perm: "coupons:read" }, async () => ({ coupons: await couponAdmin.listAll() }));
  add("POST", "/api/admin/coupons", { perm: "coupons:write" }, async (ctx) => created(ctx, "coupon", await couponAdmin.create(ctx, ctx.body)));
  add("PUT", "/api/admin/coupons/:code", { perm: "coupons:write" }, async (ctx) => ({ coupon: await couponAdmin.update(ctx, ctx.params.code, ctx.body) }));

  // ---- Fotos de producto (cuerpo binario, tipo validado por contenido) ----
  add("POST", "/api/admin/products/:id/image", IMAGE_UPLOAD, async (ctx) => ({ product: await productImages.upload(ctx, ctx.params.id, ctx.bytes) }));
  add("DELETE", "/api/admin/products/:id/image", { perm: "catalog:write" }, async (ctx) => ({ product: await productImages.remove(ctx, ctx.params.id) }));

  // ---- Clientes (solo lectura) ----
  add("GET", "/api/admin/customers", { perm: "customers:read" }, async () => ({ customers: await customers.list() }));
  add("GET", "/api/admin/customers/:id", { perm: "customers:read" }, (ctx) => customers.detail(ctx, ctx.params.id));
}
