// Notificador realtime: escucha los hechos del bus de eventos y avisa a quien corresponda.
// - Los eventos son SENALES (ids y estados): el navegador pide el detalle a la API, que es la que autoriza.
// - Quien recibe que lo decide la matriz de permisos del dominio, no la base de datos.
// - Canal publico "catalog" para datos publicos; canal privado "s:<id>" por sesion para todo lo demas.

export const CATALOG_CHANNEL = "catalog";

/** @param {{ events: object, channels: ReturnType<import("./realtimeChannels.mjs").createRealtimeChannels> }} deps */
export function createNotifier({ events, channels }) {
  const { publish } = channels;
  const publishPublic = (event, payload) => publish([CATALOG_CHANNEL], event, payload);

  async function toStaff(perm, event, payload) {
    await publish(await channels.resolve({ perm }), event, payload);
  }

  const handlers = {
    "product.changed": async ({ productIds }) => {
      await publishPublic("catalog.products", { productIds });
      await toStaff("inventory:read", "admin.inventory", { productIds });
    },
    "stock.changed": async ({ productIds }) => {
      await publishPublic("catalog.stock", { productIds });
      await toStaff("inventory:read", "admin.inventory", { productIds });
    },
    "category.changed": async ({ categoryId }) => {
      await publishPublic("catalog.categories", { categoryId });
      await toStaff("categories:read", "admin.categories", { categoryId });
    },
    "coupon.changed": async ({ code }) => {
      await publishPublic("catalog.coupons", { code });
      await toStaff("coupons:read", "admin.coupons", { code });
    },
    "review.created": async ({ productId, reviewId }) => {
      await publishPublic("catalog.reviews", { productId });
      await toStaff("reviews:moderate", "admin.reviews", { productId, reviewId });
    },
    "review.moderated": async ({ productId, reviewId, hidden }) => {
      await publishPublic("catalog.reviews", { productId });
      await toStaff("reviews:moderate", "admin.reviews", { productId, reviewId, hidden });
    },
    "order.created": (payload) => handlers["order.updated"](payload),
    "order.updated": async ({ orderId, userId, status }) => {
      await publish(await channels.resolve({ userIds: [userId] }), "order.updated", { orderId, status });
      await toStaff("orders:read", "admin.orders", { orderId, status });
    },
    "user.updated": ({ userId }) => toStaff("users:read", "admin.users", { userId }),
    "access.changed": ({ kind }) => toStaff("access:read", "admin.access", { kind }),
    "audit.recorded": ({ id, action, outcome }) => toStaff("audit:read", "audit.recorded", { id, action, outcome }),
    // Los canales de las sesiones revocadas se calculan antes de borrarlas (ver sessionService)
    "session.revoked": ({ channels, reason }) => publish(channels, "session.revoked", { reason }),
  };

  function attach() {
    for (const [event, handler] of Object.entries(handlers)) events.on(event, handler);
  }

  return { attach };
}
