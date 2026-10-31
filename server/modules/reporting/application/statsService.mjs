// Resumen del panel: ventas, stock bajo y alertas de seguridad de las ultimas 24 h.
import { PAID_STATUSES } from "../../sales/index.mjs";
import { isLowStock } from "../../catalog/index.mjs";

const DAY_MS = 24 * 3600 * 1000;

const SECURITY_COUNTERS = {
  loginFailures24h: (e) => e.action === "auth.login" && e.outcome === "failure",
  authzDenied24h: (e) => e.action === "authz.denied",
  rateLimited24h: (e) => e.action === "ratelimit.block",
  webhookRejected24h: (e) => e.action === "payment.webhook" && e.outcome !== "ok",
  csrfRejected24h: (e) => e.action.startsWith("csrf."),
};

export function createStatsService({ orders, products, auditLog, orderService }) {
  async function summary() {
    await orderService.expireOverdue();
    const since = new Date(Date.now() - DAY_MS).toISOString();
    const [allOrders, allProducts, recent] = await Promise.all([orders.list(), products.list(), auditLog.list({ since, limit: 2000 })]);
    const byStatus = {};
    let revenue = 0;
    for (const order of allOrders) {
      byStatus[order.status] = (byStatus[order.status] ?? 0) + 1;
      if (PAID_STATUSES.includes(order.status)) revenue += order.total;
    }
    const security = Object.fromEntries(Object.entries(SECURITY_COUNTERS).map(([key, matches]) => [key, recent.filter(matches).length]));
    return {
      revenue,
      orders: allOrders.length,
      byStatus,
      lowStock: allProducts.filter(isLowStock).map(({ id, name, stock }) => ({ id, name, stock })),
      security,
    };
  }

  return { summary };
}
