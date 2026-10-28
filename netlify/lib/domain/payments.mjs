// Reglas para aceptar un aviso de pago de la pasarela (T09).

export const WEBHOOK_TOLERANCE_SEC = 300;
const EVENT_ID = /^evt_[A-Za-z0-9_-]{10,64}$/;

/** Cabecera "t=<segundos>,v1=<hmac>" → { timestamp, signature } (valores invalidos quedan en null). */
export function parseSignatureHeader(header) {
  const parts = Object.fromEntries(String(header ?? "").split(",").map((p) => p.split("=")).filter((p) => p.length === 2));
  const timestamp = Number(parts.t);
  return { timestamp: Number.isInteger(timestamp) ? timestamp : null, signature: parts.v1 || null };
}

export const isFresh = (timestamp, nowSec = Date.now() / 1000) => Math.abs(nowSec - timestamp) <= WEBHOOK_TOLERANCE_SEC;

/** Texto que se firma: marca de tiempo + cuerpo exacto recibido. */
export const signedPayload = (timestamp, rawBody) => `${timestamp}.${rawBody}`;

export const isValidEventId = (id) => typeof id === "string" && EVENT_ID.test(id);

/** Motivo por el que el pago no corresponde al pedido, o null si todo coincide. */
export function paymentMismatch(order, data) {
  if (order.status !== "pendiente_pago") return `estado ${order.status}`;
  if (data.amount !== order.total || data.currency !== "GTQ") return "monto no coincide";
  return null;
}

/** Solo los datos de pago que la tienda conserva (nunca el numero de tarjeta). */
export const paymentRecord = (data, eventId) => ({
  ref: String(data.ref).slice(0, 64),
  last4: String(data.last4).slice(-4),
  brand: String(data.brand).slice(0, 20),
  eventId,
});
