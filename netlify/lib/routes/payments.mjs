// Webhook de la pasarela sandbox (frontera F4).
// Verificacion criptografica HMAC + ventana de tiempo + idempotencia + validacion del monto (T09).
import { HttpError } from "../http.mjs";
import { putJSON, mutateJSON } from "../store.mjs";
import { hmacHex, subkey, safeEqual } from "../crypto.mjs";
import { audit } from "../audit.mjs";

const TOLERANCE_SEC = 300;

export async function signWebhook(rawBody, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${hmacHex(await subkey("webhook"), `${t}.${rawBody}`)}`;
}

export default function paymentRoutes(add) {
  add("POST", "/api/payments/webhook", { webhook: true }, async (ctx) => {
    const reject = async (status, reason) => {
      await audit(ctx, "payment.webhook", { outcome: "rejected", details: { reason } });
      throw new HttpError(status, "Webhook rechazado");
    };
    const header = ctx.req.headers.get("sandbox-signature") || "";
    const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")).filter((p) => p.length === 2));
    const t = Number(parts.t);
    if (!parts.v1 || !Number.isInteger(t)) return reject(401, "firma ausente");
    if (Math.abs(Date.now() / 1000 - t) > TOLERANCE_SEC) return reject(401, "firma expirada");
    const expected = hmacHex(await subkey("webhook"), `${t}.${ctx.raw}`);
    if (!safeEqual(parts.v1, expected)) return reject(401, "firma inválida");

    const evt = ctx.body;
    if (typeof evt.id !== "string" || !/^evt_[A-Za-z0-9_-]{10,64}$/.test(evt.id)) return reject(400, "evento malformado");
    // Idempotencia: un mismo evento solo se procesa una vez
    const first = await putJSON("payments", `evt/${evt.id}`, { receivedAt: new Date().toISOString(), type: evt.type }, { onlyIfNew: true });
    if (!first.modified) return { received: true, duplicate: true };
    if (evt.type !== "payment.succeeded") return { received: true, ignored: true };

    const d = evt.data || {};
    let problem = null;
    const order = await mutateJSON("orders", String(d.orderId || "-"), (o) => {
      problem = null;
      if (o.status !== "pendiente_pago") { problem = `estado ${o.status}`; return undefined; }
      if (d.amount !== o.total || d.currency !== "GTQ") { problem = "monto no coincide"; return undefined; }
      return {
        ...o,
        status: "pagado",
        payment: { ref: String(d.ref).slice(0, 64), last4: String(d.last4).slice(-4), brand: String(d.brand).slice(0, 20), eventId: evt.id },
        history: [...o.history, { status: "pagado", at: new Date().toISOString(), by: "pasarela:webhook" }],
      };
    });
    if (!order) return reject(404, "pedido inexistente");
    if (problem) return reject(409, problem);

    if (order.coupon) {
      await mutateJSON("users", `u/${order.userId}`, (u) =>
        u.couponsUsed?.includes(order.coupon) ? undefined : { ...u, couponsUsed: [...(u.couponsUsed ?? []), order.coupon] }
      );
    }
    await audit(ctx, "payment.webhook", { target: `order:${order.id}`, details: { event: evt.id, amount: d.amount } });
    return { received: true };
  });
}
