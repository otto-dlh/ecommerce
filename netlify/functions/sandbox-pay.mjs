// Simulacion de un proveedor de pagos externo en ambiente de pruebas (frontera F4).
// La tienda NUNCA recibe el numero de tarjeta ni el CVV: los datos van directo a este "proveedor",
// que solo devuelve una referencia, la marca y los ultimos 4 digitos (alcance PCI DSS reducido).
// Tarjetas de prueba: 4242 4242 4242 4242 (aprobada) · 4000 0000 0000 0002 (rechazada).
import { randomBytes } from "node:crypto";
import { getContainer } from "../lib/infra/container.mjs";
import { BUCKETS } from "../lib/application/rateLimiter.mjs";
import { HttpError, readJsonBody, jsonResponse } from "../lib/http/http.mjs";
import { toHttpError, headersFor } from "../lib/http/errorMapper.mjs";

const DECLINED_TEST_CARD = "4000000000000002";

function luhn(num) {
  let sum = 0;
  for (let i = 0; i < num.length; i++) {
    let digit = Number(num[num.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

const brandOf = (n) => (n.startsWith("4") ? "visa" : /^5[1-5]/.test(n) ? "mastercard" : /^3[47]/.test(n) ? "amex" : "otra");

function parsePayment(body) {
  const number = String(body.card?.number ?? "").replace(/[\s-]/g, "");
  const exp = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(String(body.card?.exp ?? ""));
  if (!/^\d{13,19}$/.test(number) || !luhn(number)) throw new HttpError(400, "Número de tarjeta inválido");
  if (!exp || new Date(2000 + Number(exp[2]), Number(exp[1])) <= new Date()) throw new HttpError(400, "Fecha de expiración inválida");
  if (!/^\d{3,4}$/.test(String(body.card?.cvc ?? ""))) throw new HttpError(400, "CVV inválido");
  if (typeof body.orderId !== "string" || !Number.isInteger(body.amount)) throw new HttpError(400, "Solicitud de pago inválida");
  return { number, orderId: body.orderId, amount: body.amount };
}

const paymentEvent = ({ number, orderId, amount }) => ({
  id: `evt_${randomBytes(12).toString("base64url")}`,
  type: "payment.succeeded",
  created: Math.floor(Date.now() / 1000),
  data: { orderId, amount, currency: "GTQ", ref: `pay_${randomBytes(9).toString("base64url")}`, last4: number.slice(-4), brand: brandOf(number) },
});

export default async (req, context) => {
  const url = new URL(req.url);
  const ctx = { ip: context?.ip || "0.0.0.0", user: null, session: null, userAgent: "sandbox-pay" };
  try {
    if (req.method !== "POST") throw new HttpError(405, "Método no permitido");
    const origin = req.headers.get("origin");
    if (origin && origin !== url.origin) throw new HttpError(403, "Origen no permitido");
    const { services } = await getContainer();
    await services.rateLimiter.hit(ctx, BUCKETS.SANDBOX_PAY, ctx.ip, 10, 600);

    const payment = parsePayment((await readJsonBody(req)).body);
    if (payment.number === DECLINED_TEST_CARD) return jsonResponse(200, { status: "declined", message: "Tarjeta rechazada por el emisor (prueba)" });

    // Notificacion servidor a servidor, firmada con HMAC-SHA256
    const event = paymentEvent(payment);
    const raw = JSON.stringify(event);
    const res = await fetch(new URL("/api/payments/webhook", url.origin), {
      method: "POST",
      headers: { "content-type": "application/json", "sandbox-signature": services.payments.sign(raw) },
      body: raw,
    });
    if (!res.ok) return jsonResponse(200, { status: "rejected_by_merchant", message: "El comercio rechazó la notificación (monto o estado no válido)" });
    return jsonResponse(200, { status: "approved", ref: event.data.ref, last4: event.data.last4, brand: event.data.brand });
  } catch (err) {
    const httpError = toHttpError(err);
    if (httpError) return jsonResponse(httpError.status, { error: httpError.message, ...httpError.extra }, headersFor(httpError));
    console.error(JSON.stringify({ type: "sandbox_error", message: err?.message }));
    return jsonResponse(500, { error: "Error del proveedor de pagos" });
  }
};

export const config = { path: "/sandbox/pay" };
