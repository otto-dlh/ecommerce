// Avisos de la pasarela (frontera F4): firma HMAC + ventana de tiempo + idempotencia + monto (T09).
import { ConflictError, NotFoundError, UnauthenticatedError, ValidationError } from "../../../shared/domain/errors.mjs";
import { parseSignatureHeader, isFresh, signedPayload, isValidEventId, paymentMismatch, paymentRecord } from "../domain/payments.mjs";

const PURPOSE = "webhook";
const REJECTED = "Webhook rechazado";

export function createPaymentService({ keyring, paymentEvents, orders, coupons, audit, events }) {
  /** Firma que usa la pasarela simulada para notificar a la tienda. */
  const sign = (rawBody, timestamp = Math.floor(Date.now() / 1000)) => `t=${timestamp},v1=${keyring.sign(PURPOSE, signedPayload(timestamp, rawBody))}`;

  async function reject(ctx, ErrorType, reason) {
    await audit.record(ctx, "payment.webhook", { outcome: "rejected", details: { reason } });
    throw new ErrorType(REJECTED);
  }

  async function assertAuthentic(ctx, rawBody, signatureHeader) {
    const { timestamp, signature } = parseSignatureHeader(signatureHeader);
    if (!signature || timestamp === null) await reject(ctx, UnauthenticatedError, "firma ausente");
    if (!isFresh(timestamp)) await reject(ctx, UnauthenticatedError, "firma expirada");
    if (!keyring.verify(PURPOSE, signedPayload(timestamp, rawBody), signature)) await reject(ctx, UnauthenticatedError, "firma inválida");
  }

  async function markPaid(ctx, order, data, eventId) {
    try {
      const { order: paid } = await orders.updateStatus(order.id, {
        from: ["pendiente_pago"], to: "pagado", by: "pasarela:webhook", patch: { payment: paymentRecord(data, eventId) },
      });
      return paid;
    } catch (err) {
      if (err instanceof ConflictError) return reject(ctx, ConflictError, "estado cambió durante el pago");
      throw err;
    }
  }

  async function handleWebhook(ctx, { rawBody, signatureHeader, event }) {
    await assertAuthentic(ctx, rawBody, signatureHeader);
    if (!isValidEventId(event?.id)) return reject(ctx, ValidationError, "evento malformado");
    // Idempotencia: un mismo evento solo se procesa una vez
    if (!(await paymentEvents.registerOnce(event.id, { type: String(event.type) }))) return { received: true, duplicate: true };
    if (event.type !== "payment.succeeded") return { received: true, ignored: true };

    const data = event.data ?? {};
    const order = await orders.findById(String(data.orderId ?? ""));
    if (!order) return reject(ctx, NotFoundError, "pedido inexistente");
    const mismatch = paymentMismatch(order, data);
    if (mismatch) return reject(ctx, ConflictError, mismatch);

    const paid = await markPaid(ctx, order, data, event.id);
    if (paid.coupon) await coupons.redeem({ code: paid.coupon, userId: paid.userId, orderId: paid.id });
    await audit.record(ctx, "payment.webhook", { target: `order:${paid.id}`, details: { event: event.id, amount: data.amount } });
    await events.emit("order.updated", { orderId: paid.id, userId: paid.userId, status: paid.status, from: "pendiente_pago", total: paid.total, actorId: null });
    return { received: true };
  }

  return { sign, handleWebhook };
}
