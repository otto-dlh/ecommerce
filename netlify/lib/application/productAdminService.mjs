// Administracion de productos e inventario. Cada cambio queda auditado (T03 - no repudio).
import { ConflictError, NotFoundError, ValidationError } from "../domain/errors.mjs";
import * as v from "../domain/validate.mjs";
import { parseProductInput, parseStockAdjustment } from "../domain/catalog.mjs";

const byName = (a, b) => a.name.localeCompare(b.name, "es");

export function createProductAdminService({ products, categories, files, audit, events, logger = console }) {
  /** Al reemplazar la imagen por una local, la foto subida antes deja de usarse y se borra. */
  async function releaseStoredImage(product) {
    if (!product?.imageKey) return;
    try {
      await files.remove(product.imageKey);
    } catch (err) {
      logger.error(JSON.stringify({ type: "image_cleanup_error", key: product.imageKey, message: err.message }));
    }
  }

  async function assertCategoryExists(categoryId) {
    if (!(await categories.findById(categoryId))) throw new ValidationError("La categoría no existe", { field: "categoría" });
  }

  async function listAll() {
    const [all, cats] = await Promise.all([products.list(), categories.list()]);
    const names = new Map(cats.map((c) => [c.id, c.name]));
    return all.sort(byName).map((p) => ({ ...p, category: names.get(p.categoryId) ?? "" }));
  }

  async function create(ctx, body) {
    const data = parseProductInput(body);
    await assertCategoryExists(data.categoryId);
    const now = new Date().toISOString();
    let product;
    try {
      product = await products.create({ ...data, image: data.image ?? null, imageKey: null, stock: 0, createdAt: now, updatedAt: now });
    } catch (err) {
      if (err instanceof ConflictError) throw new ConflictError("Ya existe un producto con ese id");
      throw err;
    }
    await audit.record(ctx, "product.create", { target: `product:${product.id}` });
    await events.emit("product.changed", { productIds: [product.id] });
    return product;
  }

  async function update(ctx, rawId, body) {
    const id = v.id(rawId);
    const changes = parseProductInput(body, { partial: true });
    if (changes.categoryId) await assertCategoryExists(changes.categoryId);
    const replacesImage = changes.image !== undefined;
    const before = replacesImage ? await products.findById(id) : null;
    const product = await products.update(id, { ...changes, ...(replacesImage && { imageKey: null }), updatedAt: new Date().toISOString() });
    if (!product) throw new NotFoundError("Producto no encontrado");
    if (replacesImage) await releaseStoredImage(before);
    await audit.record(ctx, "product.update", { target: `product:${id}`, details: changes });
    await events.emit("product.changed", { productIds: [id] });
    return product;
  }

  async function adjustStock(ctx, rawId, body) {
    const id = v.id(rawId);
    const { delta, reason } = parseStockAdjustment(body);
    if (delta === 0) throw new ValidationError("El ajuste no puede ser 0");
    const result = await products.adjustStock(id, delta);
    if (!result) throw new NotFoundError("Producto no encontrado");
    // Quien, cuando, cuanto y por que (T03 - no repudio)
    await audit.record(ctx, "stock.adjust", { target: `product:${id}`, details: { ...result, delta, reason } });
    await events.emit("stock.changed", { productIds: [id], decreased: delta < 0, actorId: ctx.user.id });
    return products.findById(id);
  }

  return { listAll, create, update, adjustStock };
}
