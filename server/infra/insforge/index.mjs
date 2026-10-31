// Proveedor de datos InsForge: PostgreSQL (via PostgREST), Storage y Realtime.
// El endpoint, la clave y el bucket llegan ya validados desde server/config.mjs.
// Un archivo por modulo (espejo de server/modules); db.mjs es el unico que importa @insforge/sdk.
import { createInsforgeClient, createDb } from "./db.mjs";
import { createRateLimitStore, createFileStorage } from "./shared.mjs";
import { createUserRepository, createSessionRepository, createMfaChallengeRepository, createPolicyRepository } from "./identity.mjs";
import { createCategoryRepository, createProductRepository, createReviewRepository } from "./catalog.mjs";
import { createCouponRepository, createOrderRepository, createPaymentEventRepository } from "./sales.mjs";
import { createAddressRepository } from "./customers.mjs";
import { createAuditRepository } from "./audit.mjs";
import { createRealtimePublisher } from "./notifications.mjs";

/**
 * @param {{ url: string, apiKey: string, imageBucket: string }} settings
 * @returns {import("../../bootstrap/ports.mjs").Adapters}
 */
export function createInsforgeAdapters(settings) {
  const db = createDb(createInsforgeClient(settings));
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
    files: createFileStorage(db, settings.imageBucket),
    realtime: createRealtimePublisher(db),
  };
}
