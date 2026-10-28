import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { newContainer, loginAs, anonCtx } from "../helpers.mjs";
import { ConflictError, UnauthenticatedError, ValidationError } from "../../netlify/lib/domain/errors.mjs";

const ADDRESS = { name: "Prueba", line1: "Laboratorio 123", city: "Guatemala", phone: "55555555" };

async function pendingOrder(c, coupon) {
  const ctx = await loginAs(c, "cliente");
  const order = await c.services.checkout.placeOrder(ctx, { items: [{ productId: "mochila", qty: 1 }], address: ADDRESS, coupon });
  return { ctx, order };
}

function signedEvent(c, data, { id = `evt_${randomUUID().replaceAll("-", "")}`, timestamp, signature } = {}) {
  const event = { id, type: "payment.succeeded", data: { currency: "GTQ", ref: "pay_x", last4: "4242", brand: "visa", ...data } };
  const rawBody = JSON.stringify(event);
  return { rawBody, event, signatureHeader: signature ?? c.services.payments.sign(rawBody, timestamp) };
}

test("T09: un aviso firmado marca el pedido como pagado y canjea el cupon", async () => {
  const c = await newContainer();
  const { ctx, order } = await pendingOrder(c, "BIENVENIDA10");
  const result = await c.services.payments.handleWebhook(anonCtx(), signedEvent(c, { orderId: order.id, amount: order.total }));
  assert.deepEqual(result, { received: true });
  const paid = await c.repos.orders.findById(order.id);
  assert.equal(paid.status, "pagado");
  assert.equal(paid.payment.last4, "4242");
  await assert.rejects(c.services.pricing.quote(ctx.user, [{ productId: "mochila", qty: 1 }], "BIENVENIDA10"), /Ya utilizaste/);
});

test("T09: firma falsa o vencida se rechaza y queda auditada", async () => {
  const c = await newContainer();
  const { order } = await pendingOrder(c);
  const data = { orderId: order.id, amount: order.total };
  await assert.rejects(c.services.payments.handleWebhook(anonCtx(), signedEvent(c, data, { signature: `t=${Math.floor(Date.now() / 1000)},v1=deadbeef` })), UnauthenticatedError);
  await assert.rejects(c.services.payments.handleWebhook(anonCtx(), signedEvent(c, data, { timestamp: Math.floor(Date.now() / 1000) - 3600 })), UnauthenticatedError);
  await assert.rejects(c.services.payments.handleWebhook(anonCtx(), signedEvent(c, data, { id: "evt_corto" })), ValidationError);
  assert.equal((await c.repos.orders.findById(order.id)).status, "pendiente_pago");
  const rejected = (await c.services.audit.list()).filter((e) => e.action === "payment.webhook" && e.outcome === "rejected");
  assert.equal(rejected.length, 3);
});

test("T09: el monto debe coincidir y cada evento se procesa una sola vez", async () => {
  const c = await newContainer();
  const { order } = await pendingOrder(c);
  await assert.rejects(c.services.payments.handleWebhook(anonCtx(), signedEvent(c, { orderId: order.id, amount: 1 })), ConflictError);
  const ok = signedEvent(c, { orderId: order.id, amount: order.total });
  await c.services.payments.handleWebhook(anonCtx(), ok);
  assert.deepEqual(await c.services.payments.handleWebhook(anonCtx(), ok), { received: true, duplicate: true });
});
