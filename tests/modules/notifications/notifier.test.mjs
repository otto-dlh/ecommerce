import { test } from "node:test";
import assert from "node:assert/strict";
import { newContainer, loginAs } from "../../helpers.mjs";

const ADDRESS = { name: "Prueba", line1: "Laboratorio 123", city: "Guatemala", phone: "55555555" };
const channelOf = (ctx) => `s:${ctx.session.rtChannel}`;
const published = (c, event) => c.repos.realtime.published.filter((m) => m.event === event);
const reachedBy = (c, event) => new Set(published(c, event).flatMap((m) => m.channels));

test("un pedido avisa a su dueño y al personal con permiso, nunca a otros clientes", async () => {
  const c = await newContainer();
  const [cliente, cliente2, operador, auditor, admin] = await Promise.all(["cliente", "cliente2", "operador", "auditor", "admin"].map((who) => loginAs(c, who)));
  await c.services.checkout.placeOrder(cliente, { items: [{ productId: "gorra", qty: 1 }], address: ADDRESS });

  const owner = reachedBy(c, "order.updated");
  assert.ok(owner.has(channelOf(cliente)));
  assert.equal(owner.has(channelOf(cliente2)), false, "otro cliente no se entera");
  const staff = reachedBy(c, "admin.orders");
  for (const who of [operador, auditor, admin]) assert.ok(staff.has(channelOf(who)));
  assert.equal(staff.has(channelOf(cliente)), false);

  const [stock] = published(c, "catalog.stock");
  assert.deepEqual(stock.channels, ["catalog"]);
  assert.deepEqual(stock.payload, { productIds: ["gorra"] });
});

test("la bitácora en vivo llega solo a quien puede leerla (admin y auditor)", async () => {
  const c = await newContainer();
  const [operador, auditor, admin] = await Promise.all(["operador", "auditor", "admin"].map((who) => loginAs(c, who)));
  c.repos.realtime.published.length = 0;
  await c.services.productAdmin.adjustStock(operador, "gorra", { delta: 1, reason: "Conteo" });
  const audit = reachedBy(c, "audit.recorded");
  assert.ok(audit.has(channelOf(admin)) && audit.has(channelOf(auditor)));
  assert.equal(audit.has(channelOf(operador)), false);
});

test("revocar sesiones avisa por el canal de cada sesión revocada", async () => {
  const c = await newContainer();
  const admin = await loginAs(c, "admin");
  const operador = await loginAs(c, "operador");
  await c.services.access.revokeSession(admin, operador.session.keyHash);
  const [message] = published(c, "session.revoked");
  assert.deepEqual(message.channels, [channelOf(operador)]);
  assert.deepEqual(message.payload, { reason: "closed_by_admin" });
});

test("los avisos son señales: no llevan datos personales", async () => {
  const c = await newContainer();
  const cliente = await loginAs(c, "cliente");
  await c.services.checkout.placeOrder(cliente, { items: [{ productId: "gorra", qty: 1 }], address: ADDRESS });
  const text = JSON.stringify(c.repos.realtime.published);
  for (const secret of ["Laboratorio 123", "55555555", "cliente@tienda.test"]) assert.equal(text.includes(secret), false, secret);
});
