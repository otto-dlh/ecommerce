// Resenas: publicacion por clientes y moderacion por el personal.
// El texto se guarda tal cual; la proteccion XSS es la codificacion de salida en React + CSP (T07).
import { randomUUID } from "node:crypto";
import { NotFoundError } from "../domain/errors.mjs";
import * as v from "../domain/validate.mjs";
import { publicDisplayName } from "../domain/users.mjs";
import { BUCKETS } from "./rateLimiter.mjs";
import { publicReview } from "./catalogService.mjs";

export function createReviewService({ reviews, products, rateLimiter, audit, events }) {
  async function create(ctx, rawProductId, body) {
    await rateLimiter.hit(ctx, BUCKETS.REVIEW, ctx.user.id, 5, 600);
    const product = await products.findById(v.id(rawProductId));
    if (!product || !product.active) throw new NotFoundError("Producto no encontrado");
    const review = await reviews.create({
      id: randomUUID(),
      productId: product.id,
      userId: ctx.user.id,
      userName: publicDisplayName(ctx.user),
      rating: v.int(body.rating, "calificación", { min: 1, max: 5 }),
      text: v.str(body.text, "reseña", { min: 3, max: 500 }),
      hidden: false,
      moderatedBy: null,
      createdAt: new Date().toISOString(),
    });
    await events.emit("review.created", { productId: product.id, reviewId: review.id, productName: product.name, rating: review.rating, authorId: ctx.user.id });
    return publicReview(review);
  }

  /** Resenas para moderar (incluye ocultas y el producto al que pertenecen). */
  async function listForModeration(filter = {}) {
    const list = await reviews.list({ hidden: filter.hidden, limit: 200 });
    const found = await products.findByIds([...new Set(list.map((r) => r.productId))]);
    const names = new Map(found.map((p) => [p.id, p.name]));
    return list.map((r) => ({ ...r, productName: names.get(r.productId) ?? r.productId }));
  }

  async function setHidden(ctx, rawId, hidden) {
    const id = v.id(rawId);
    const review = await reviews.setHidden(id, { hidden, moderatedBy: ctx.user.id });
    if (!review) throw new NotFoundError("Reseña no encontrada");
    await audit.record(ctx, hidden ? "review.hide" : "review.restore", { target: `review:${id}`, details: { productId: review.productId } });
    await events.emit("review.moderated", { productId: review.productId, reviewId: id, hidden });
    return review;
  }

  return { create, listForModeration, setHidden };
}
