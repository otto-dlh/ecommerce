// Proveedor de datos en memoria: implementa todos los puertos sin dependencias externas.
// Sirve para pruebas y para demostrar que cambiar de base de datos no toca dominio ni casos de uso.
// Atomicidad: cada operacion critica corre sin `await` intermedios (JavaScript es de un solo hilo).
// Un archivo por modulo, espejo de server/modules y de server/infra/insforge.
import { createKeyedRepository } from "./store.mjs";
import { createRateLimitStore, createFileStorage } from "./shared.mjs";
import { createUserRepository, createSessionRepository, createMfaChallengeRepository, createPolicyRepository } from "./identity.mjs";
import { createCategoryRepository, createProductRepository, createReviewRepository } from "./catalog.mjs";
import { createCouponRepository, createOrderRepository, createPaymentEventRepository } from "./sales.mjs";
import { createAddressRepository } from "./customers.mjs";
import { createAuditRepository } from "./audit.mjs";
import { createRealtimePublisher } from "./notifications.mjs";

/** @returns {import("../../bootstrap/ports.mjs").Adapters} */
export function createMemoryAdapters() {
  const productStore = createKeyedRepository((p) => p.id, "Ya existe un producto con ese id");
  return {
    users: createUserRepository(),
    sessions: createSessionRepository(),
    mfaChallenges: createMfaChallengeRepository(),
    rateLimits: createRateLimitStore(),
    policy: createPolicyRepository(),
    categories: createCategoryRepository(),
    products: createProductRepository(productStore),
    coupons: createCouponRepository(),
    reviews: createReviewRepository(),
    orders: createOrderRepository(productStore),
    addresses: createAddressRepository(),
    paymentEvents: createPaymentEventRepository(),
    audit: createAuditRepository(),
    files: createFileStorage(),
    realtime: createRealtimePublisher(),
  };
}
