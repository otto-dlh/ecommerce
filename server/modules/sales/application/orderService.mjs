// Ciclo de vida del pedido: consultas con control de titularidad, cambios de estado y expiracion.
import { ForbiddenError, NotFoundError, ConflictError } from "../../../shared/domain/errors.mjs";
import * as v from "../../../shared/domain/validate.mjs";
import { can } from "../../identity/index.mjs";
import { TRANSITIONS, STAFF_TARGET_STATUSES, statusesLeadingTo, releasesStock, isPaymentOverdue } from "../domain/orderStateMachine.mjs";

const SYSTEM_EXPIRATION = "sistema:expiracion";
const productIdsOf = (order) => order.items.map((item) => item.productId);

export function createOrderService({ orders, audit, events }) {
  /** Cambia el estado de forma atomica y anuncia el cambio. */
  async function transition(id, to, by) {
    const { order, from } = await orders.updateStatus(id, { from: statusesLeadingTo(to), to, by, releaseStock: releasesStock(to) });
    await events.emit("order.updated", { orderId: order.id, userId: order.userId, status: order.status, from, total: order.total, actorId: by });
    if (releasesStock(to)) await events.emit("stock.changed", { productIds: productIdsOf(order) });
    return { order, from };
  }

  /** Cancela los pedidos cuya ventana de pago vencio y libera su stock. */
  async function expireOverdue() {
    const overdue = await orders.listOverdue(new Date().toISOString());
    for (const order of overdue) {
      try {
        await transition(order.id, "cancelado", SYSTEM_EXPIRATION);
      } catch (err) {
        if (!(err instanceof ConflictError)) throw err; // otra solicitud ya lo cambio
      }
    }
    return overdue.length;
  }

  async function refreshIfOverdue(order) {
    if (!isPaymentOverdue(order)) return order;
    await expireOverdue();
    return (await orders.findById(order.id)) ?? order;
  }

  /**
   * Devuelve el pedido solo si pertenece al usuario o si tiene permiso de lectura de pedidos
   * (ASVS v5.0.0-8.2.2, T04). Mismo 404 exista o no: no se revela la existencia de pedidos ajenos.
   */
  async function getForActor(ctx, rawId) {
    const order = await orders.findById(v.id(rawId));
    if (!order || (order.userId !== ctx.user.id && !can(ctx.user, "orders:read"))) {
      if (order) await audit.record(ctx, "authz.denied", { outcome: "denied", target: `order:${order.id}` });
      throw new NotFoundError("Pedido no encontrado");
    }
    return refreshIfOverdue(order);
  }

  async function listMine(user) {
    await expireOverdue();
    return orders.listByUser(user.id);
  }

  async function cancelMine(ctx, rawId) {
    const order = await getForActor(ctx, rawId);
    if (order.userId !== ctx.user.id) throw new NotFoundError("Pedido no encontrado");
    if (order.status !== "pendiente_pago") throw new ConflictError("Solo se pueden cancelar pedidos pendientes de pago");
    const { order: updated, from } = await transition(order.id, "cancelado", ctx.user.id);
    await audit.record(ctx, "order.status", { target: `order:${order.id}`, details: { from, to: "cancelado" } });
    return updated;
  }

  async function listAll(filter = {}) {
    await expireOverdue();
    return { orders: await orders.list(filter), transitions: TRANSITIONS };
  }

  async function changeStatus(ctx, rawId, body) {
    const id = v.id(rawId);
    const to = v.oneOf(body.status, "estado", STAFF_TARGET_STATUSES);
    if (to === "cancelado" && !can(ctx.user, "orders:cancel")) {
      await audit.record(ctx, "authz.denied", { outcome: "denied", target: `order:${id}`, details: { to } });
      throw new ForbiddenError("Solo un administrador puede cancelar pedidos pagados");
    }
    const { order, from } = await transition(id, to, ctx.user.id);
    await audit.record(ctx, "order.status", { target: `order:${id}`, details: { from, to } });
    return order;
  }

  return { getForActor, listMine, cancelMine, listAll, changeStatus, expireOverdue };
}
