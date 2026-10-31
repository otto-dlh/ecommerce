// Fotos de producto: se validan por contenido y se guardan en el almacenamiento de archivos.
import { randomUUID } from "node:crypto";
import { NotFoundError } from "../../../shared/domain/errors.mjs";
import * as v from "../../../shared/domain/validate.mjs";
import { assertValidImage } from "../domain/images.mjs";

export function createProductImageService({ products, files, audit, events, logger = console }) {
  async function findProduct(rawId) {
    const product = await products.findById(v.id(rawId));
    if (!product) throw new NotFoundError("Producto no encontrado");
    return product;
  }

  /** Borra el archivo anterior sin interrumpir la operacion si ya no existe. */
  async function discard(key) {
    if (!key) return;
    try {
      await files.remove(key);
    } catch (err) {
      logger.error(JSON.stringify({ type: "image_cleanup_error", key, message: err.message }));
    }
  }

  async function upload(ctx, rawId, bytes) {
    const product = await findProduct(rawId);
    const { mime, ext } = assertValidImage(bytes);
    // Nombre generado por el servidor: el nombre original del archivo nunca se usa
    const stored = await files.put(`products/${product.id}-${randomUUID()}.${ext}`, bytes, mime);
    const updated = await products.update(product.id, { image: stored.url, imageKey: stored.key, updatedAt: new Date().toISOString() });
    await discard(product.imageKey);
    await audit.record(ctx, "product.image", { target: `product:${product.id}`, details: { tipo: mime, bytes: bytes.length } });
    await events.emit("product.changed", { productIds: [product.id] });
    return updated;
  }

  async function remove(ctx, rawId) {
    const product = await findProduct(rawId);
    const updated = await products.update(product.id, { image: null, imageKey: null, updatedAt: new Date().toISOString() });
    await discard(product.imageKey);
    await audit.record(ctx, "product.image", { target: `product:${product.id}`, details: { eliminada: true } });
    await events.emit("product.changed", { productIds: [product.id] });
    return updated;
  }

  return { upload, remove };
}
