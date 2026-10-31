// Contrato completo que debe cumplir un proveedor de datos (adaptador): la union de los puertos de cada modulo.
// El contenedor lo verifica al arrancar: un adaptador incompleto falla de inmediato, no a mitad de una compra.
import { SHARED_PORTS } from "../shared/ports.mjs";
import { IDENTITY_PORTS } from "../modules/identity/index.mjs";
import { CATALOG_PORTS } from "../modules/catalog/index.mjs";
import { SALES_PORTS } from "../modules/sales/index.mjs";
import { CUSTOMER_PORTS } from "../modules/customers/index.mjs";
import { AUDIT_PORTS } from "../modules/audit/index.mjs";
import { NOTIFICATION_PORTS } from "../modules/notifications/index.mjs";

export const PORTS = Object.freeze({
  ...SHARED_PORTS, ...IDENTITY_PORTS, ...CATALOG_PORTS, ...SALES_PORTS, ...CUSTOMER_PORTS, ...AUDIT_PORTS, ...NOTIFICATION_PORTS,
});

/**
 * @typedef {object} Adapters
 * @property {import("../shared/ports.mjs").RateLimitStore} rateLimits
 * @property {import("../shared/ports.mjs").FileStorage} files
 * @property {import("../modules/identity/ports.mjs").UserRepository} users
 * @property {import("../modules/identity/ports.mjs").SessionRepository} sessions
 * @property {import("../modules/identity/ports.mjs").MfaChallengeRepository} mfaChallenges
 * @property {import("../modules/identity/ports.mjs").PolicyRepository} policy
 * @property {import("../modules/catalog/ports.mjs").CategoryRepository} categories
 * @property {import("../modules/catalog/ports.mjs").ProductRepository} products
 * @property {import("../modules/catalog/ports.mjs").ReviewRepository} reviews
 * @property {import("../modules/sales/ports.mjs").CouponRepository} coupons
 * @property {import("../modules/sales/ports.mjs").OrderRepository} orders
 * @property {import("../modules/sales/ports.mjs").PaymentEventRepository} paymentEvents
 * @property {import("../modules/customers/ports.mjs").AddressRepository} addresses
 * @property {import("../modules/audit/ports.mjs").AuditRepository} audit
 * @property {import("../modules/notifications/ports.mjs").RealtimePublisher} realtime
 */

/** Lanza un error que enumera los metodos faltantes del adaptador. */
export function assertImplementsPorts(adapters, providerName) {
  const missing = [];
  for (const [port, methods] of Object.entries(PORTS)) {
    for (const method of methods) {
      if (typeof adapters?.[port]?.[method] !== "function") missing.push(`${port}.${method}`);
    }
  }
  if (missing.length) throw new Error(`El proveedor de datos "${providerName}" no implementa: ${missing.join(", ")}`);
  return adapters;
}
