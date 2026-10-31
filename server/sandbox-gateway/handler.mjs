// Simulacion de un proveedor de pagos externo en ambiente de pruebas (frontera F4).
// La tienda NUNCA recibe el numero de tarjeta ni el CVV: los datos van directo a este "proveedor",
// que solo devuelve una referencia, la marca y los ultimos 4 digitos (alcance PCI DSS reducido).
import { getContainer } from "../bootstrap/container.mjs";
import { BUCKETS } from "../shared/security/rateLimiter.mjs";
import { HttpError, readJsonBody, jsonResponse } from "../http/http.mjs";
import { DECLINED_TEST_CARD, parsePayment, paymentEvent } from "./cards.mjs";
import { toHttpError, headersFor } from "../http/errorMapper.mjs";

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
