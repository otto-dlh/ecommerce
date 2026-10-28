// Reglas del catalogo: validacion de productos y categorias, busqueda y proyeccion publica.
import * as v from "./validate.mjs";

export const SORT_OPTIONS = Object.freeze(["relevancia", "precio-asc", "precio-desc", "nombre"]);
export const LOW_STOCK_THRESHOLD = 3;

// Solo rutas locales autoalojadas: no se aceptan URLs externas (CSP y privacidad del visitante)
const LOCAL_IMAGE = /^\/products\/[a-z0-9-]+\.(jpg|png|webp)$/;

/** Parametros de busqueda publicos. La busqueda se trata como texto literal (T08). */
export function parseCatalogQuery(params) {
  return {
    q: v.str(params.get("q") ?? "", "q", { optional: true, max: 60 }).toLowerCase(),
    categoryId: params.get("category") ? v.slug(params.get("category"), "category") : "",
    sort: v.oneOf(params.get("sort") || "relevancia", "sort", SORT_OPTIONS),
  };
}

const SORTERS = {
  relevancia: null,
  "precio-asc": (a, b) => a.price - b.price,
  "precio-desc": (a, b) => b.price - a.price,
  nombre: (a, b) => a.name.localeCompare(b.name, "es"),
};

/** Filtra y ordena productos activos sin construir consultas con el texto del usuario. */
export function searchProducts(products, { q, categoryId, sort }) {
  let items = products.filter((p) => p.active);
  if (q) items = items.filter((p) => `${p.name} ${p.description}`.toLowerCase().includes(q));
  if (categoryId) items = items.filter((p) => p.categoryId === categoryId);
  const sorter = SORTERS[sort];
  return sorter ? [...items].sort(sorter) : items;
}

/** Campos que puede ver cualquier visitante. */
export function publicProduct(product, categoriesById) {
  const { id, name, description, price, categoryId, emoji, color, image, stock } = product;
  return { id, name, description, price, categoryId, category: categoriesById.get(categoryId)?.name ?? "", emoji, color, image: image ?? null, stock };
}

export const publicCategory = ({ id, name, description }) => ({ id, name, description: description ?? "" });

export const isLowStock = (product) => product.active && product.stock <= LOW_STOCK_THRESHOLD;

/** Datos de producto que llegan del panel (creacion completa o edicion parcial). */
export function parseProductInput(body, { partial = false } = {}) {
  const out = {};
  const has = (key) => !partial || body[key] !== undefined;
  if (!partial) out.id = v.slug(body.id, "id");
  if (has("name")) out.name = v.str(body.name, "nombre", { min: 3, max: 80 });
  if (has("description")) out.description = v.str(body.description, "descripción", { min: 3, max: 400 });
  if (has("price")) out.price = v.int(body.price, "precio (centavos)", { min: 100, max: 10_000_000 });
  if (has("categoryId")) out.categoryId = v.slug(body.categoryId, "categoría");
  if (has("emoji")) out.emoji = v.str(body.emoji, "emoji", { min: 1, max: 8 });
  if (has("color")) out.color = v.str(body.color, "color", { pattern: /^#[0-9a-fA-F]{6}$/ });
  if (has("active")) out.active = v.bool(body.active, "activo");
  if (body.image === "" || body.image === null) out.image = null;
  else if (body.image !== undefined) out.image = v.str(body.image, "imagen", { max: 80, pattern: LOCAL_IMAGE });
  return out;
}

/** Datos de categoria que llegan del panel. */
export function parseCategoryInput(body, { partial = false } = {}) {
  const out = {};
  const has = (key) => !partial || body[key] !== undefined;
  if (!partial) out.id = v.slug(body.id, "id");
  if (has("name")) out.name = v.str(body.name, "nombre", { min: 2, max: 40 });
  if (has("description")) out.description = v.str(body.description ?? "", "descripción", { optional: true, max: 200 });
  if (has("active")) out.active = v.bool(body.active ?? true, "activa");
  if (has("sortOrder")) out.sortOrder = v.int(body.sortOrder ?? 0, "orden", { min: 0, max: 999 });
  return out;
}

export const parseStockAdjustment = (body) => ({
  delta: v.int(body.delta, "ajuste", { min: -1000, max: 1000 }),
  reason: v.str(body.reason, "motivo", { min: 3, max: 200 }),
});
