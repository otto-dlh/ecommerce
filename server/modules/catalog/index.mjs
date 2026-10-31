// API publica del modulo de catalogo: productos, inventario, categorias, fotos y resenas.
export { createCatalogService } from "./application/catalogService.mjs";
export { createProductAdminService } from "./application/productAdminService.mjs";
export { createCategoryAdminService } from "./application/categoryAdminService.mjs";
export { createProductImageService } from "./application/productImageService.mjs";
export { createReviewService } from "./application/reviewService.mjs";
export { isLowStock } from "./domain/catalog.mjs";
export { registerCatalogRoutes } from "./http/routes.mjs";
export { CATALOG_PORTS } from "./ports.mjs";
