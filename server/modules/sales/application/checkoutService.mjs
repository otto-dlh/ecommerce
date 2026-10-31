// Checkout: cotiza con datos del servidor y reserva stock de forma atomica (T02, T14).
import { randomUUID } from "node:crypto";
import { parseAddress } from "../domain/addresses.mjs";
import { PAYMENT_WINDOW_MS } from "../domain/orderStateMachine.mjs";
import { BUCKETS } from "../../../shared/security/rateLimiter.mjs";

const toOrderLine = ({ productId, name, unitPrice, qty, lineTotal }) => ({ productId, name, unitPrice, qty, lineTotal });

export function createCheckoutService({ pricing, orders, orderService, rateLimiter, audit, events }) {
  async function placeOrder(ctx, body) {
    await rateLimiter.hit(ctx, BUCKETS.CHECKOUT, ctx.user.id, 10, 600);
    const address = parseAddress(body.address);
    // Libera reservas vencidas antes de competir por el stock
    await orderService.expireOverdue();
    const quote = await pricing.quote(ctx.user, body.items, body.coupon || null);
    const now = Date.now();
    const order = await orders.placeOrder({
      id: randomUUID(),
      userId: ctx.user.id,
      items: quote.lines.map(toOrderLine),
      subtotal: quote.subtotal,
      discount: quote.discount,
      shipping: quote.shipping,
      total: quote.total,
      coupon: quote.coupon?.code ?? null,
      address,
      status: "pendiente_pago",
      history: [{ status: "pendiente_pago", at: new Date(now).toISOString(), by: ctx.user.id }],
      payment: null,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + PAYMENT_WINDOW_MS).toISOString(),
    });
    await audit.record(ctx, "order.created", { target: `order:${order.id}`, details: { total: order.total } });
    await events.emit("order.created", { orderId: order.id, userId: order.userId, status: order.status, total: order.total, actorId: ctx.user.id });
    await events.emit("stock.changed", { productIds: order.items.map((item) => item.productId), decreased: true, actorId: ctx.user.id });
    return order;
  }

  return { placeOrder };
}
