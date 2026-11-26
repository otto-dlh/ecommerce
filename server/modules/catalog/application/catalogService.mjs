// Catalogo publico: categorias, busqueda de productos y detalle con resenas visibles.
import { NotFoundError } from "../../../shared/domain/errors.mjs";
import * as v from "../../../shared/domain/validate.mjs";
import { parseCatalogQuery, searchProducts, publicProduct, publicCategory, looksLikeInjection } from "../domain/catalog.mjs";

const byOrder = (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "es");

export const publicReview = ({ id, userName, rating, text, createdAt }) => ({ id, userName, rating, text, createdAt });

export function createCatalogService({ products, categories, reviews, audit }) {
  async function categoriesById() {
    return new Map((await categories.list()).map((c) => [c.id, c]));
  }

  async function listCategories() {
    const all = await categories.list();
    return all.filter((c) => c.active).sort(byOrder).map(publicCategory);
  }

  /**
   * Busqueda publica del catalogo. El texto se compara literalmente (nunca arma una consulta),
   * pero si trae marcas de inyeccion el intento queda en la bitacora.
   * @param {object} ctx contexto de la solicitud; ctx.query trae los parametros
   */
  async function listProducts(ctx) {
    const query = parseCatalogQuery(ctx.query);
    if (looksLikeInjection(query.q)) {
      await audit.record(ctx, "search.suspicious", { outcome: "rejected", details: { busqueda: query.q } });
    }
    const [all, cats] = await Promise.all([products.list(), categoriesById()]);
    return searchProducts(all, query).map((p) => publicProduct(p, cats));
  }

  async function getProduct(rawId) {
    const product = await products.findById(v.id(rawId));
    if (!product || !product.active) throw new NotFoundError("Producto no encontrado");
    const [cats, visible] = await Promise.all([categoriesById(), reviews.listByProduct(product.id)]);
    return { product: publicProduct(product, cats), reviews: visible.map(publicReview) };
  }

  return { listCategories, listProducts, getProduct, categoriesById };
}
