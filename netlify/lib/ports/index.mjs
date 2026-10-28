// Contrato completo que debe cumplir un proveedor de datos (adaptador).
// El contenedor lo verifica al arrancar: un adaptador incompleto falla de inmediato, no a mitad de una compra.
import { IDENTITY_PORTS } from "./identity.mjs";
import { CATALOG_PORTS } from "./catalog.mjs";
import { ORDER_PORTS } from "./orders.mjs";
import { PLATFORM_PORTS } from "./platform.mjs";

export const PORTS = Object.freeze({ ...IDENTITY_PORTS, ...CATALOG_PORTS, ...ORDER_PORTS, ...PLATFORM_PORTS });

/**
 * @typedef {object} Adapters
 * @property {import("./identity.mjs").UserRepository} users
 * @property {import("./identity.mjs").SessionRepository} sessions
 * @property {import("./identity.mjs").MfaChallengeRepository} mfaChallenges
 * @property {import("./identity.mjs").RateLimitStore} rateLimits
 * @property {import("./identity.mjs").PolicyRepository} policy
 * @property {import("./catalog.mjs").CategoryRepository} categories
 * @property {import("./catalog.mjs").ProductRepository} products
 * @property {import("./catalog.mjs").CouponRepository} coupons
 * @property {import("./catalog.mjs").ReviewRepository} reviews
 * @property {import("./orders.mjs").OrderRepository} orders
 * @property {import("./orders.mjs").AddressRepository} addresses
 * @property {import("./orders.mjs").PaymentEventRepository} paymentEvents
 * @property {import("./platform.mjs").AuditRepository} audit
 * @property {import("./platform.mjs").FileStorage} files
 * @property {import("./platform.mjs").RealtimePublisher} realtime
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
