// Reglas del proveedor simulado: validacion de la tarjeta (Luhn, vencimiento, CVV) y evento de pago firmado despues.
// Tarjetas de prueba: 4242 4242 4242 4242 (aprobada) · 4000 0000 0000 0002 (rechazada).
import { randomBytes } from "node:crypto";
import { HttpError } from "../http/http.mjs";

export const DECLINED_TEST_CARD = "4000000000000002";

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

export function parsePayment(body) {
  const number = String(body.card?.number ?? "").replace(/[\s-]/g, "");
  const exp = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(String(body.card?.exp ?? ""));
  if (!/^\d{13,19}$/.test(number) || !luhn(number)) throw new HttpError(400, "Número de tarjeta inválido");
  if (!exp || new Date(2000 + Number(exp[2]), Number(exp[1])) <= new Date()) throw new HttpError(400, "Fecha de expiración inválida");
  if (!/^\d{3,4}$/.test(String(body.card?.cvc ?? ""))) throw new HttpError(400, "CVV inválido");
  if (typeof body.orderId !== "string" || !Number.isInteger(body.amount)) throw new HttpError(400, "Solicitud de pago inválida");
  return { number, orderId: body.orderId, amount: body.amount };
}

export const paymentEvent = ({ number, orderId, amount }) => ({
  id: `evt_${randomBytes(12).toString("base64url")}`,
  type: "payment.succeeded",
  created: Math.floor(Date.now() / 1000),
  data: { orderId, amount, currency: "GTQ", ref: `pay_${randomBytes(9).toString("base64url")}`, last4: number.slice(-4), brand: brandOf(number) },
});
