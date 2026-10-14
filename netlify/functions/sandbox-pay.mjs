// Simulacion de un proveedor de pagos externo en ambiente de pruebas (frontera F4).
// La tienda NUNCA recibe el numero de tarjeta ni el CVV: los datos van directo a este "proveedor",
// que solo devuelve una referencia, la marca y los ultimos 4 digitos (alcance PCI DSS reducido).
// Tarjetas de prueba: 4242 4242 4242 4242 (aprobada) · 4000 0000 0000 0002 (rechazada).
import { randomBytes } from "node:crypto";
import { HttpError, readBody, jsonResponse } from "../lib/http.mjs";
import { rateLimit } from "../lib/ratelimit.mjs";
import { signWebhook } from "../lib/routes/payments.mjs";

function luhn(num) {
  let sum = 0;
  for (let i = 0; i < num.length; i++) {
    let d = Number(num[num.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

const brandOf = (n) => (n.startsWith("4") ? "visa" : /^5[1-5]/.test(n) ? "mastercard" : /^3[47]/.test(n) ? "amex" : "otra");

export default async (req, context) => {
  const url = new URL(req.url);
  const ctx = { ip: context.ip, user: null };
  try {
    if (req.method !== "POST") throw new HttpError(405, "Método no permitido");
    const origin = req.headers.get("origin");
    if (origin && origin !== url.origin) throw new HttpError(403, "Origen no permitido");
    await rateLimit(ctx, "sandbox-pay", context.ip, 10, 600);
    const { body } = await readBody(req);

    const number = String(body.card?.number ?? "").replace(/[\s-]/g, "");
    const exp = String(body.card?.exp ?? "");
    const cvc = String(body.card?.cvc ?? "");
    if (!/^\d{13,19}$/.test(number) || !luhn(number)) throw new HttpError(400, "Número de tarjeta inválido");
    const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(exp);
    if (!m || new Date(2000 + Number(m[2]), Number(m[1])) <= new Date()) throw new HttpError(400, "Fecha de expiración inválida");
    if (!/^\d{3,4}$/.test(cvc)) throw new HttpError(400, "CVV inválido");
    if (typeof body.orderId !== "string" || !Number.isInteger(body.amount)) throw new HttpError(400, "Solicitud de pago inválida");

    if (number === "4000000000000002") return jsonResponse(200, { status: "declined", message: "Tarjeta rechazada por el emisor (prueba)" });

    const event = {
      id: `evt_${randomBytes(12).toString("base64url")}`,
      type: "payment.succeeded",
      created: Math.floor(Date.now() / 1000),
      data: {
        orderId: body.orderId,
        amount: body.amount,
        currency: "GTQ",
        ref: `pay_${randomBytes(9).toString("base64url")}`,
        last4: number.slice(-4),
        brand: brandOf(number),
      },
    };
    // Notificacion servidor a servidor, firmada con HMAC-SHA256
    const raw = JSON.stringify(event);
    const res = await fetch(new URL("/api/payments/webhook", url.origin), {
      method: "POST",
      headers: { "content-type": "application/json", "sandbox-signature": await signWebhook(raw) },
      body: raw,
    });
    if (!res.ok) {
      return jsonResponse(200, { status: "rejected_by_merchant", message: "El comercio rechazó la notificación (monto o estado no válido)" });
    }
    return jsonResponse(200, { status: "approved", ref: event.data.ref, last4: event.data.last4, brand: event.data.brand });
  } catch (err) {
    if (err instanceof HttpError) return jsonResponse(err.status, { error: err.message, ...err.extra });
    console.error(JSON.stringify({ type: "sandbox_error", message: err?.message }));
    return jsonResponse(500, { error: "Error del proveedor de pagos" });
  }
};

export const config = { path: "/sandbox/pay" };
