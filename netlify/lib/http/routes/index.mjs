// Registro de todas las rutas de la API (cada area en su propio modulo).
import { registerAuthRoutes } from "./authRoutes.mjs";
import { registerShopRoutes } from "./shopRoutes.mjs";
import { registerPaymentRoutes } from "./paymentRoutes.mjs";
import { registerAdminRoutes } from "./adminRoutes.mjs";
import { registerAccessRoutes } from "./accessRoutes.mjs";
import { registerCatalogAdminRoutes } from "./catalogAdminRoutes.mjs";

const AREAS = [registerAuthRoutes, registerShopRoutes, registerPaymentRoutes, registerAdminRoutes, registerAccessRoutes, registerCatalogAdminRoutes];

export function registerRoutes(router, services) {
  for (const register of AREAS) {
    register(router, services);
  }
}
