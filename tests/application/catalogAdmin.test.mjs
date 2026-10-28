import { test } from "node:test";
import assert from "node:assert/strict";
import { newContainer, loginAs } from "../helpers.mjs";
import { ConflictError, ValidationError } from "../../netlify/lib/domain/errors.mjs";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16]);

test("categorías: alta, edición, conteo de productos y desactivación en vez de borrado", async () => {
  const c = await newContainer();
  const admin = await loginAs(c, "admin");
  await c.services.categoryAdmin.create(admin, { id: "libros", name: "Libros", description: "", active: true, sortOrder: 9 });
  await assert.rejects(c.services.categoryAdmin.create(admin, { id: "libros", name: "Otra", active: true, sortOrder: 1 }), ConflictError);
  await c.services.categoryAdmin.update(admin, "cafe", { active: false });
  const all = await c.services.categoryAdmin.listAll();
  assert.equal(all.find((cat) => cat.id === "cafe").products, 2);
  assert.ok((await c.services.catalog.listCategories()).every((cat) => cat.id !== "cafe"), "la desactivada no se ofrece en la tienda");
});

test("cupones: el código es único, la coherencia se valida y el máximo no baja de los usos", async () => {
  const c = await newContainer();
  const admin = await loginAs(c, "admin");
  const coupon = await c.services.couponAdmin.create(admin, { code: "verano15", label: "Verano 15 %", type: "percent", value: 15, minSubtotal: 0, oncePerUser: false, active: true });
  assert.equal(coupon.code, "VERANO15");
  await assert.rejects(c.services.couponAdmin.update(admin, "VERANO15", { value: 150 }), /entre 1 y 100/);
  await c.repos.coupons.update("VERANO15", { uses: 4 });
  await assert.rejects(c.services.couponAdmin.update(admin, "VERANO15", { maxUses: 2 }), /no puede ser menor/);
  const quote = await c.services.pricing.quote(null, [{ productId: "mochila", qty: 1 }], "verano15");
  assert.equal(quote.discount, Math.floor(42500 * 0.15));
});

test("fotos: se valida el tipo real del archivo y al reemplazar se borra la anterior", async () => {
  const c = await newContainer();
  const admin = await loginAs(c, "admin");
  await assert.rejects(c.services.productImages.upload(admin, "gorra", new TextEncoder().encode("<svg onload=alert(1)>")), (err) => err instanceof ValidationError && /JPEG, PNG o WebP/.test(err.message));
  await assert.rejects(c.services.productImages.upload(admin, "gorra", new Uint8Array(2 * 1024 * 1024 + 1).fill(0xff)), /2 MB/);

  const first = await c.services.productImages.upload(admin, "gorra", PNG);
  assert.match(first.imageKey, /^products\/gorra-[0-9a-f-]{36}\.png$/);
  assert.match(first.image, /^data:image\/png;base64,/);
  const second = await c.services.productImages.upload(admin, "gorra", JPEG);
  assert.match(second.imageKey, /\.jpg$/);
  const removed = await c.services.productImages.remove(admin, "gorra");
  assert.equal(removed.image, null);
  const actions = (await c.services.audit.list()).filter((e) => e.action === "product.image");
  assert.equal(actions.length, 3);
});

test("clientes: resumen de compras y la consulta del detalle queda auditada", async () => {
  const c = await newContainer();
  const auditor = await loginAs(c, "auditor");
  const list = await c.services.customers.list();
  const carlos = list.find((cu) => cu.email === "cliente2@tienda.test");
  assert.equal(carlos.totalSpent, 21500);
  const detail = await c.services.customers.detail(auditor, carlos.id);
  assert.equal(detail.orders.length, 1);
  assert.ok((await c.services.audit.list()).some((e) => e.action === "customer.view" && e.target === `user:${carlos.id}`));
  const [staff] = await c.services.userAdmin.list({ role: "operador" });
  await assert.rejects(c.services.customers.detail(auditor, staff.id), /Cliente no encontrado/);
});

test("moderación: las reseñas traen el nombre del producto y se pueden ocultar y restaurar", async () => {
  const c = await newContainer();
  const cliente = await loginAs(c, "cliente");
  const operador = await loginAs(c, "operador");
  const review = await c.services.reviews.create(cliente, "taza-barro", { rating: 5, text: "Preciosa" });
  const [listed] = await c.services.reviews.listForModeration();
  assert.equal(listed.productName, "Taza de barro de Chinautla");
  await c.services.reviews.setHidden(operador, review.id, true);
  assert.equal((await c.services.catalog.getProduct("taza-barro")).reviews.length, 0);
  await c.services.reviews.setHidden(operador, review.id, false);
  assert.equal((await c.services.catalog.getProduct("taza-barro")).reviews.length, 1);
});
