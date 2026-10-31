// Repositorios del modulo de catalogo sobre PostgreSQL de InsForge: categorias, productos y resenas.
import { toIso, pickColumns, isUuid, withDuplicateMessage } from "./db.mjs";

const CATEGORY_FIELDS = { id: "id", name: "name", description: "description", active: "active", sortOrder: "sort_order" };

const categoryFromRow = (row) => row && { id: row.id, name: row.name, description: row.description, active: row.active, sortOrder: row.sort_order };

export function createCategoryRepository(db) {
  const categories = () => db.from("categories");
  return {
    async list() { return (await db.run(categories().select("*").order("sort_order").order("name"))).map(categoryFromRow); },
    async findById(id) { return categoryFromRow(await db.run(categories().select("*").eq("id", id).maybeSingle())); },
    async create(category) {
      return withDuplicateMessage(async () => categoryFromRow(await db.run(categories().insert([pickColumns(category, CATEGORY_FIELDS)]).select().single())), "Ya existe una categoría con ese id");
    },
    async update(id, changes) {
      return categoryFromRow(await db.run(categories().update(pickColumns(changes, CATEGORY_FIELDS)).eq("id", id).select().maybeSingle()));
    },
  };
}

const PRODUCT_FIELDS = {
  id: "id", name: "name", description: "description", price: "price", categoryId: "category_id", emoji: "emoji", color: "color",
  image: "image", imageKey: "image_key", stock: "stock", active: "active", createdAt: "created_at", updatedAt: "updated_at",
};

const productFromRow = (row) =>
  row && {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    categoryId: row.category_id,
    emoji: row.emoji,
    color: row.color,
    image: row.image,
    imageKey: row.image_key,
    stock: row.stock,
    active: row.active,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };

export function createProductRepository(db) {
  const products = () => db.from("products");
  return {
    async list() { return (await db.run(products().select("*"))).map(productFromRow); },
    async findById(id) { return productFromRow(await db.run(products().select("*").eq("id", id).maybeSingle())); },
    async findByIds(ids) {
      if (ids.length === 0) return [];
      return (await db.run(products().select("*").in("id", ids))).map(productFromRow);
    },
    async create(product) {
      return withDuplicateMessage(async () => productFromRow(await db.run(products().insert([pickColumns(product, PRODUCT_FIELDS)]).select().single())), "Ya existe un producto con ese id");
    },
    async update(id, changes) {
      return productFromRow(await db.run(products().update(pickColumns(changes, PRODUCT_FIELDS)).eq("id", id).select().maybeSingle()));
    },
    async adjustStock(id, delta) {
      const [row] = await db.rpc("adjust_stock", { p_product_id: id, p_delta: delta });
      return row ? { before: row.stock_before, after: row.stock_after } : null;
    },
    async countByCategory(categoryId) { return db.count(products().select("id", { count: "exact", head: true }).eq("category_id", categoryId)); },
  };
}

const REVIEW_FIELDS = {
  id: "id", productId: "product_id", userId: "user_id", userName: "user_name", rating: "rating", text: "text",
  hidden: "hidden", moderatedBy: "moderated_by", createdAt: "created_at",
};

const reviewFromRow = (row) =>
  row && {
    id: row.id,
    productId: row.product_id,
    userId: row.user_id,
    userName: row.user_name,
    rating: row.rating,
    text: row.text,
    hidden: row.hidden,
    moderatedBy: row.moderated_by,
    createdAt: toIso(row.created_at),
  };

export function createReviewRepository(db) {
  const reviews = () => db.from("reviews");
  const newestFirst = (query) => query.order("created_at", { ascending: false });
  return {
    async listByProduct(productId, { includeHidden = false } = {}) {
      let query = newestFirst(reviews().select("*").eq("product_id", productId));
      if (!includeHidden) query = query.eq("hidden", false);
      return (await db.run(query)).map(reviewFromRow);
    },
    async list({ hidden, limit = 200 } = {}) {
      let query = newestFirst(reviews().select("*")).limit(limit);
      if (hidden !== undefined) query = query.eq("hidden", hidden);
      return (await db.run(query)).map(reviewFromRow);
    },
    async findById(id) {
      if (!isUuid(id)) return null;
      return reviewFromRow(await db.run(reviews().select("*").eq("id", id).maybeSingle()));
    },
    async create(review) { return reviewFromRow(await db.run(reviews().insert([pickColumns(review, REVIEW_FIELDS)]).select().single())); },
    async setHidden(id, { hidden, moderatedBy }) {
      if (!isUuid(id)) return null;
      return reviewFromRow(await db.run(reviews().update({ hidden, moderated_by: moderatedBy }).eq("id", id).select().maybeSingle()));
    },
  };
}
