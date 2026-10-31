// Acceso a la API del modulo de catalogo: tienda publica, resenas y administracion del catalogo.
import { ENDPOINTS } from "./endpoints.js";
import { callEndpoint } from "./callEndpoint.js";

const E = ENDPOINTS.catalog;
const byId = (id) => ({ params: { id } });

export const catalogApi = {
  /** @param {{ q?: string, category?: string, sort?: string }} filters */
  searchProducts: (filters) => callEndpoint(E.products, { query: filters }),
  product: (id) => callEndpoint(E.product, byId(id)),
  categories: () => callEndpoint(E.categories),
  createReview: (productId, review) => callEndpoint(E.createReview, { ...byId(productId), body: review }),
};

export const catalogAdminApi = {
  products: () => callEndpoint(E.adminProducts),
  createProduct: (product) => callEndpoint(E.createProduct, { body: product }),
  updateProduct: (id, changes) => callEndpoint(E.updateProduct, { ...byId(id), body: changes }),
  adjustStock: (id, { delta, reason }) => callEndpoint(E.adjustStock, { ...byId(id), body: { delta, reason } }),
  /** La foto viaja tal cual (Blob/File con su tipo); el servidor verifica el tipo real. */
  uploadImage: (id, file) => callEndpoint(E.uploadImage, { ...byId(id), body: file }),
  removeImage: (id) => callEndpoint(E.removeImage, byId(id)),
  categories: () => callEndpoint(E.adminCategories),
  createCategory: (category) => callEndpoint(E.createCategory, { body: category }),
  updateCategory: (id, changes) => callEndpoint(E.updateCategory, { ...byId(id), body: changes }),
  /** @param {{ hidden?: "true"|"false" }} [filter] */
  reviews: (filter = {}) => callEndpoint(E.adminReviews, { query: filter }),
  hideReview: (id) => callEndpoint(E.hideReview, byId(id)),
  restoreReview: (id) => callEndpoint(E.restoreReview, byId(id)),
};
