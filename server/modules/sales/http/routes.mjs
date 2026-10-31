// Rutas HTTP del modulo de ventas.
import { registerCheckoutRoutes } from "./checkoutRoutes.mjs";
import { registerSalesAdminRoutes } from "./salesAdminRoutes.mjs";
import { registerPaymentRoutes } from "./paymentRoutes.mjs";

export function registerSalesRoutes(router, services) {
  registerCheckoutRoutes(router, services);
  registerSalesAdminRoutes(router, services);
  registerPaymentRoutes(router, services);
}
