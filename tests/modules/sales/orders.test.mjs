import { test } from "node:test";
import assert from "node:assert/strict";
import { newContainer, loginAs, captureEvents } from "../../helpers.mjs";
import { ConflictError, NotFoundError, ForbiddenError } from "../../../server/shared/domain/errors.mjs";
import { DEMO_FOREIGN_ORDER_ID } from "../../../server/bootstrap/seedData.mjs";

const ADDRESS = { name: "Prueba", line1: "Laboratorio 123", city: "Guatemala", phone: "55555555" };
const buy = (c, ctx, items, extra = {}) => c.services.checkout.placeOrder(ctx, { items, address: ADDRESS, ...extra });

test("T02: la cotizacion ignora el precio manipulado", async () => {
  const c = await newContainer();
  const quote = await c.services.pricing.quote(null, [{ productId: "cafe-huehue", qty: 1, price: 1 }], null);
  assert.equal(quote.subtotal, 9500);
});

test("T14: dos compras simultaneas de la ultima unidad, solo una gana", async () => {
  const c = await newContainer();
  const [a, b] = [await loginAs(c, "cliente"), await loginAs(c, "cliente2")];
  const results = await Promise.allSettled([buy(c, a, [{ productId: "edicion-limitada", qty: 1 }]), buy(c, b, [{ productId: "edicion-limitada", qty: 1 }])]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.ok(results.find((r) => r.status === "rejected").reason instanceof ConflictError);
  assert.equal((await c.repos.products.findById("edicion-limitada")).stock, 0);
});

test("T14: si una linea no tiene stock, no se reserva ninguna", async () => {
  const c = await newContainer();
  const ctx = await loginAs(c, "cliente");
  await assert.rejects(buy(c, ctx, [{ productId: "cafe-huehue", qty: 2 }, { productId: "teclado-mec", qty: 10 }]), ConflictError);
  assert.equal((await c.repos.products.findById("cafe-huehue")).stock, 38, "el cafe conserva su stock (40 - 2 del pedido demo)");
});

test("compra, cancelacion por el cliente y liberacion del stock", async () => {
  const c = await newContainer();
  const ctx = await loginAs(c, "cliente");
  const events = captureEvents(c);
  const order = await buy(c, ctx, [{ productId: "gorra", qty: 2 }]);
  assert.equal(order.status, "pendiente_pago");
  assert.equal((await c.repos.products.findById("gorra")).stock, 28);
  await c.services.orders.cancelMine(ctx, order.id);
  assert.equal((await c.repos.products.findById("gorra")).stock, 30);
  assert.ok(events.some((e) => e.event === "order.updated" && e.payload.status === "cancelado"));
});

test("los pedidos con la ventana de pago vencida se cancelan solos", async () => {
  const c = await newContainer();
  const ctx = await loginAs(c, "cliente");
  const order = await buy(c, ctx, [{ productId: "botella", qty: 1 }]);
  await c.repos.orders.updateStatus(order.id, { from: ["pendiente_pago"], to: "pendiente_pago", by: "test", patch: { expiresAt: "2000-01-01T00:00:00.000Z" } });
  const mine = await c.services.orders.listMine(ctx.user);
  assert.equal(mine.find((o) => o.id === order.id).status, "cancelado");
  assert.equal((await c.repos.products.findById("botella")).stock, 50);
});

test("T04: un cliente no puede ver el pedido de otro (404 uniforme y auditado)", async () => {
  const c = await newContainer();
  const ctx = await loginAs(c, "cliente");
  await assert.rejects(c.services.orders.getForActor(ctx, DEMO_FOREIGN_ORDER_ID), NotFoundError);
  await assert.rejects(c.services.orders.getForActor(ctx, "no-existe"), NotFoundError);
  const denied = (await c.services.audit.list()).filter((e) => e.action === "authz.denied");
  assert.equal(denied.length, 1, "solo el pedido existente deja rastro");
});

test("T04: el auditor y el operador pueden leer pedidos ajenos; solo el admin cancela pagados", async () => {
  const c = await newContainer();
  for (const role of ["auditor", "operador"]) {
    const ctx = await loginAs(c, role);
    assert.equal((await c.services.orders.getForActor(ctx, DEMO_FOREIGN_ORDER_ID)).id, DEMO_FOREIGN_ORDER_ID);
  }
  const cliente = await loginAs(c, "cliente");
  const order = await buy(c, cliente, [{ productId: "playera", qty: 1 }]);
  await c.repos.orders.updateStatus(order.id, { from: ["pendiente_pago"], to: "pagado", by: "test" });
  const operador = await loginAs(c, "operador");
  await assert.rejects(c.services.orders.changeStatus(operador, order.id, { status: "cancelado" }), ForbiddenError);
  const admin = await loginAs(c, "admin");
  assert.equal((await c.services.orders.changeStatus(admin, order.id, { status: "cancelado" })).status, "cancelado");
});

test("direcciones: solo el titular puede borrarlas", async () => {
  const c = await newContainer();
  const owner = await loginAs(c, "cliente");
  const other = await loginAs(c, "cliente2");
  const address = await c.services.addresses.create(owner.user, ADDRESS);
  await assert.rejects(c.services.addresses.remove(other, address.id), NotFoundError);
  await c.services.addresses.remove(owner, address.id);
  assert.deepEqual(await c.services.addresses.list(owner.user), []);
});
