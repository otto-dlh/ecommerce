// Repositorios en memoria del modulo de catalogo.
import { integrityErrors } from "../../shared/domain/errors.mjs";
import { copy, newestFirst, createKeyedRepository } from "./store.mjs";

export function createCategoryRepository() {
  const base = createKeyedRepository((c) => c.id, "Ya existe una categoría con ese id");
  return { list: base.list, findById: base.find, create: base.create, update: base.update };
}

export function createProductRepository(products) {
  return {
    list: products.list,
    findById: products.find,
    async findByIds(ids) { return ids.map((id) => products.rows.get(id)).filter(Boolean).map(copy); },
    create: products.create,
    update: products.update,
    async adjustStock(id, delta) {
      const product = products.rows.get(id);
      if (!product) return null;
      if (product.stock + delta < 0) throw integrityErrors.negativeStock();
      const before = product.stock;
      product.stock += delta;
      product.updatedAt = new Date().toISOString();
      return { before, after: product.stock };
    },
    async countByCategory(categoryId) { return [...products.rows.values()].filter((p) => p.categoryId === categoryId).length; },
  };
}

export function createReviewRepository() {
  const rows = new Map();
  return {
    async listByProduct(productId, { includeHidden = false } = {}) {
      return [...rows.values()].filter((r) => r.productId === productId && (includeHidden || !r.hidden)).sort(newestFirst("createdAt")).map(copy);
    },
    async list({ hidden, limit = 200 } = {}) {
      return [...rows.values()].filter((r) => hidden === undefined || r.hidden === hidden).sort(newestFirst("createdAt")).slice(0, limit).map(copy);
    },
    async findById(id) { return copy(rows.get(id) ?? null); },
    async create(review) { rows.set(review.id, copy(review)); return copy(review); },
    async setHidden(id, { hidden, moderatedBy }) {
      const review = rows.get(id);
      if (!review) return null;
      Object.assign(review, { hidden, moderatedBy });
      return copy(review);
    },
  };
}
