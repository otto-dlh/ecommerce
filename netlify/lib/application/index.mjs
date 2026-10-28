// Composicion de los casos de uso a partir de los adaptadores (inyeccion de dependencias).
// Ningun servicio importa un adaptador: todos reciben sus puertos aqui.
import { createAuditService } from "./auditService.mjs";
import { createRateLimiter } from "./rateLimiter.mjs";
import { createPolicyService } from "./policyService.mjs";
import { createSessionService } from "./sessionService.mjs";
import { createAuthService } from "./authService.mjs";
import { createCatalogService } from "./catalogService.mjs";
import { createPricingService } from "./pricingService.mjs";
import { createOrderService } from "./orderService.mjs";
import { createCheckoutService } from "./checkoutService.mjs";
import { createPaymentService } from "./paymentService.mjs";
import { createReviewService } from "./reviewService.mjs";
import { createAddressService } from "./addressService.mjs";
import { createProductAdminService } from "./productAdminService.mjs";
import { createUserAdminService } from "./userAdminService.mjs";
import { createStatsService } from "./statsService.mjs";
import { createAccessService } from "./accessService.mjs";
import { createCategoryAdminService } from "./categoryAdminService.mjs";
import { createCouponAdminService } from "./couponAdminService.mjs";
import { createProductImageService } from "./productImageService.mjs";
import { createCustomerService } from "./customerService.mjs";
import { createNotifier } from "./notifier.mjs";
import { createRealtimeChannels } from "./realtimeChannels.mjs";
import { createAlertService } from "./alertService.mjs";

/**
 * @param {{ repos: import("../ports/index.mjs").Adapters, keyring: ReturnType<import("../security/keyring.mjs").createKeyring>,
 *           events: ReturnType<import("./eventBus.mjs").createEventBus>, logger?: Console }} deps
 */
export function createServices({ repos, keyring, events, logger = console }) {
  const audit = createAuditService({ auditLog: repos.audit, keyring, events, logger });
  const rateLimiter = createRateLimiter({ rateLimits: repos.rateLimits, audit });
  const policy = createPolicyService({ policyStore: repos.policy, audit, events });
  const sessions = createSessionService({ sessions: repos.sessions, users: repos.users, policy, events });
  const orders = createOrderService({ orders: repos.orders, audit, events });
  const pricing = createPricingService({ products: repos.products, coupons: repos.coupons });
  // Suscriptores del bus: los casos de uso no saben que existen el realtime ni las alertas
  const channels = createRealtimeChannels({ sessions: repos.sessions, realtime: repos.realtime, logger });
  createNotifier({ events, channels }).attach();
  createAlertService({ events, products: repos.products, channels }).attach();

  return {
    audit,
    rateLimiter,
    policy,
    sessions,
    orders,
    pricing,
    auth: createAuthService({ users: repos.users, mfaChallenges: repos.mfaChallenges, sessions, rateLimiter, audit, policy, keyring }),
    catalog: createCatalogService({ products: repos.products, categories: repos.categories, reviews: repos.reviews }),
    checkout: createCheckoutService({ pricing, orders: repos.orders, orderService: orders, rateLimiter, audit, events }),
    payments: createPaymentService({ keyring, paymentEvents: repos.paymentEvents, orders: repos.orders, coupons: repos.coupons, audit, events }),
    reviews: createReviewService({ reviews: repos.reviews, products: repos.products, rateLimiter, audit, events }),
    addresses: createAddressService({ addresses: repos.addresses, audit }),
    productAdmin: createProductAdminService({ products: repos.products, categories: repos.categories, files: repos.files, audit, events, logger }),
    userAdmin: createUserAdminService({ users: repos.users, sessions, audit, events }),
    stats: createStatsService({ orders: repos.orders, products: repos.products, auditLog: repos.audit, orderService: orders }),
    access: createAccessService({ users: repos.users, sessions, rateLimiter, policy, audit, events }),
    categoryAdmin: createCategoryAdminService({ categories: repos.categories, products: repos.products, audit, events }),
    couponAdmin: createCouponAdminService({ coupons: repos.coupons, audit, events }),
    productImages: createProductImageService({ products: repos.products, files: repos.files, audit, events, logger }),
    customers: createCustomerService({ users: repos.users, orders: repos.orders, addresses: repos.addresses, audit }),
  };
}
