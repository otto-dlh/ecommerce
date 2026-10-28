import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { newContainer, loginAs, anonCtx, DEMO } from "../helpers.mjs";

const ADDRESS = { name: "Prueba", line1: "Laboratorio 123", city: "Guatemala", phone: "55555555" };
const channelOf = (ctx) => `s:${ctx.session.rtChannel}`;
const alerts = (c) => c.repos.realtime.published.filter((m) => m.event === "alert");
/** Tipos de alerta que llegaron al canal de esa sesion. */
const received = (c, ctx) => alerts(c).filter((m) => m.channels.includes(channelOf(ctx))).map((m) => m.payload.kind);
const staff = (c) => Promise.all(["operador", "auditor", "admin"].map((who) => loginAs(c, who)));

function signedPayment(c, order) {
  const event = { id: `evt_${randomUUID().replaceAll("-", "")}`, type: "payment.succeeded", data: { orderId: order.id, amount: order.total, currency: "GTQ", ref: "pay_x", last4: "4242", brand: "visa" } };
  const rawBody = JSON.stringify(event);
  return { rawBody, event, signatureHeader: c.services.payments.sign(rawBody) };
}

test("pago confirmado: avisa al cliente y a quien prepara pedidos, no al auditor ni a otros clientes", async () => {
  const c = await newContainer();
  const [cliente, cliente2] = [await loginAs(c, "cliente"), await loginAs(c, "cliente2")];
  const [operador, auditor, admin] = await staff(c);
  const order = await c.services.checkout.placeOrder(cliente, { items: [{ productId: "gorra", qty: 1 }], address: ADDRESS });
  await c.services.payments.handleWebhook(anonCtx(), signedPayment(c, order));

  assert.deepEqual(received(c, cliente), ["order.status"]);
  assert.ok(received(c, operador).includes("order.paid"));
  assert.ok(received(c, admin).includes("order.paid"));
  assert.equal(received(c, auditor).includes("order.paid"), false);
  assert.deepEqual(received(c, cliente2), []);

  c.repos.realtime.published.length = 0;
  await c.services.orders.changeStatus(operador, order.id, { status: "preparando" });
  assert.deepEqual(received(c, cliente), ["order.status"]);
  assert.deepEqual(received(c, operador), [], "quien avanza el pedido no recibe su propia alerta");
});

test("stock bajo: avisa a quien gestiona inventario, excepto a quien hizo el ajuste", async () => {
  const c = await newContainer();
  const [operador, auditor, admin] = await staff(c);
  const cliente = await loginAs(c, "cliente");
  const { stock } = await c.repos.products.findById("gorra");
  c.repos.realtime.published.length = 0;
  await c.services.productAdmin.adjustStock(operador, "gorra", { delta: -(stock - 2), reason: "Merma" });

  assert.deepEqual(received(c, admin), ["stock.low"]);
  assert.deepEqual(received(c, operador), []);
  assert.deepEqual(received(c, auditor).filter((k) => k.startsWith("stock.")), [], "el auditor no gestiona inventario");
  assert.deepEqual(received(c, cliente), []);
  const [message] = alerts(c).filter((m) => m.payload.kind === "stock.low");
  assert.deepEqual(message.payload.data, { productId: "gorra", name: "Gorra bordada", stock: 2 });
});

test("inicio de sesión nuevo: avisa a las otras sesiones abiertas de la misma cuenta", async () => {
  const c = await newContainer();
  const first = await loginAs(c, "cliente");
  const other = await loginAs(c, "cliente2");
  const second = await loginAs(c, "cliente");
  assert.deepEqual(received(c, first), ["account.new_login"]);
  assert.deepEqual(received(c, second), []);
  assert.deepEqual(received(c, other), []);
});

test("bloqueo por intentos fallidos: una alerta crítica a supervisión y un aviso al dueño", async () => {
  const c = await newContainer();
  const cliente = await loginAs(c, "cliente");
  const [operador, auditor, admin] = await staff(c);
  c.repos.realtime.published.length = 0;
  const attacker = anonCtx();
  for (let i = 0; i < 5; i++) await assert.rejects(c.services.auth.login(attacker, { email: DEMO.cliente[0], password: "incorrecta-123456" }));
  await assert.rejects(c.services.auth.login(attacker, { email: DEMO.cliente[0], password: "incorrecta-123456" }), /Demasiadas/);

  const lockouts = alerts(c).filter((m) => m.payload.kind === "security.lockout");
  assert.equal(lockouts.length, 1, "una sola alerta por bloqueo");
  assert.ok(lockouts[0].channels.includes(channelOf(admin)) && lockouts[0].channels.includes(channelOf(auditor)));
  assert.equal(lockouts[0].channels.includes(channelOf(operador)), false);
  assert.deepEqual(received(c, cliente), ["account.locked"]);
  assert.equal((await c.services.audit.list()).filter((e) => e.action === "auth.lockout").length, 1);
});

test("incidentes repetidos se agrupan: un intento de IDOR insistente genera una sola alerta", async () => {
  const c = await newContainer();
  const cliente = await loginAs(c, "cliente");
  const intruso = await loginAs(c, "cliente2");
  const [, auditor] = await staff(c);
  const order = await c.services.checkout.placeOrder(cliente, { items: [{ productId: "gorra", qty: 1 }], address: ADDRESS });
  for (let i = 0; i < 3; i++) await assert.rejects(c.services.orders.getForActor(intruso, order.id), /no encontrado/);
  assert.deepEqual(received(c, auditor).filter((k) => k === "security.authz"), ["security.authz"]);
});

test("las alertas no exponen datos personales", async () => {
  const c = await newContainer();
  await staff(c);
  const cliente = await loginAs(c, "cliente");
  const order = await c.services.checkout.placeOrder(cliente, { items: [{ productId: "gorra", qty: 1 }], address: ADDRESS });
  await c.services.payments.handleWebhook(anonCtx(), signedPayment(c, order));
  const text = JSON.stringify(alerts(c));
  for (const secret of ["Laboratorio 123", "55555555", "cliente@tienda.test", "4242"]) assert.equal(text.includes(secret), false, secret);
});
