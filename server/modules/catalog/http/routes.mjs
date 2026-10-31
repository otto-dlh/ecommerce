// Rutas HTTP del modulo de catalogo.
import { registerStorefrontRoutes } from "./storefrontRoutes.mjs";
import { registerCatalogAdminRoutes } from "./catalogAdminRoutes.mjs";

export function registerCatalogRoutes(router, services) {
  registerStorefrontRoutes(router, services);
  registerCatalogAdminRoutes(router, services);
}
