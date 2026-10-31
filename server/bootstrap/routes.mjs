// Registro de las rutas de la API: cada modulo aporta las suyas (raiz de composicion HTTP).
import { registerIdentityRoutes } from "../modules/identity/index.mjs";
import { registerCatalogRoutes } from "../modules/catalog/index.mjs";
import { registerSalesRoutes } from "../modules/sales/index.mjs";
import { registerCustomerRoutes } from "../modules/customers/index.mjs";
import { registerAuditRoutes } from "../modules/audit/index.mjs";
import { registerReportingRoutes } from "../modules/reporting/index.mjs";

const MODULE_ROUTES = [registerIdentityRoutes, registerCatalogRoutes, registerSalesRoutes, registerCustomerRoutes, registerAuditRoutes, registerReportingRoutes];

export function registerRoutes(router, services) {
  for (const register of MODULE_ROUTES) register(router, services);
}
