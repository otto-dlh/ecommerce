// Proveedor de datos InsForge: PostgreSQL (via PostgREST), Storage y Realtime.
// El endpoint y las claves llegan solo por variables de entorno.
import { createInsforgeClient, createDb } from "./db.mjs";
import { createUserRepository, createSessionRepository, createMfaChallengeRepository, createRateLimitStore, createPolicyRepository } from "./identityRepositories.mjs";
import { createCategoryRepository, createProductRepository, createCouponRepository, createReviewRepository } from "./catalogRepositories.mjs";
import { createOrderRepository, createAddressRepository, createPaymentEventRepository } from "./orderRepositories.mjs";
import { createAuditRepository, createFileStorage, createRealtimePublisher } from "./platformAdapters.mjs";

export const DEFAULT_IMAGE_BUCKET = "product-images";

/** @returns {import("../../ports/index.mjs").Adapters} */
export function createInsforgeAdapters(env) {
  const db = createDb(createInsforgeClient(env));
  return {
    users: createUserRepository(db),
    sessions: createSessionRepository(db),
    mfaChallenges: createMfaChallengeRepository(db),
    rateLimits: createRateLimitStore(db),
    policy: createPolicyRepository(db),
    categories: createCategoryRepository(db),
    products: createProductRepository(db),
    coupons: createCouponRepository(db),
    reviews: createReviewRepository(db),
    orders: createOrderRepository(db),
    addresses: createAddressRepository(db),
    paymentEvents: createPaymentEventRepository(db),
    audit: createAuditRepository(db),
    files: createFileStorage(db, env.INSFORGE_IMAGE_BUCKET || DEFAULT_IMAGE_BUCKET),
    realtime: createRealtimePublisher(db),
  };
}
