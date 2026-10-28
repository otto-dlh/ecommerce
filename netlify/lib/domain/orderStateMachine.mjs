// Maquina de estados del pedido (ASVS v5.0.0-2.3.1).
// "pagado" solo lo asigna el webhook verificado; "cancelado" libera el stock reservado.
import { integrityErrors } from "./errors.mjs";

export const ORDER_STATUSES = Object.freeze(["pendiente_pago", "pagado", "preparando", "enviado", "entregado", "cancelado"]);

export const TRANSITIONS = Object.freeze({
  pendiente_pago: ["cancelado"],
  pagado: ["preparando", "cancelado"],
  preparando: ["enviado"],
  enviado: ["entregado"],
  entregado: [],
  cancelado: [],
});

/** Estados a los que el personal puede mover un pedido desde el panel. */
export const STAFF_TARGET_STATUSES = Object.freeze(["preparando", "enviado", "entregado", "cancelado"]);

/** Estados en los que el pedido ya fue cobrado (cuentan como ingreso). */
export const PAID_STATUSES = Object.freeze(["pagado", "preparando", "enviado", "entregado"]);

/** Ventana para pagar antes de que la reserva de stock expire. */
export const PAYMENT_WINDOW_MS = 15 * 60 * 1000;

export const canTransition = (from, to) => (TRANSITIONS[from] ?? []).includes(to);

/** Estados desde los que se puede llegar a `to` (para escrituras condicionales atomicas). */
export const statusesLeadingTo = (to) => ORDER_STATUSES.filter((from) => canTransition(from, to));

export function assertTransition(from, to) {
  if (!canTransition(from, to)) throw integrityErrors.transitionNotAllowed(from, to);
}

export const isPaymentOverdue = (order, now = Date.now()) =>
  order.status === "pendiente_pago" && Boolean(order.expiresAt) && now >= Date.parse(order.expiresAt);

/** Cancelar libera el stock; ningun otro cambio de estado lo toca. */
export const releasesStock = (to) => to === "cancelado";
