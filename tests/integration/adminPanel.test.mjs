import { test } from "node:test";
import assert from "node:assert/strict";
import { newContainer, loginAs, captureEvents } from "../helpers.mjs";
import { ConflictError, ForbiddenError, ValidationError } from "../../server/shared/domain/errors.mjs";

test("T03: la bitacora detecta registros alterados en la base de datos", async () => {
  const c = await newContainer();
  const ctx = await loginAs(c, "operador");
  await c.services.productAdmin.adjustStock(ctx, "gorra", { delta: 5, reason: "Conteo físico" });
  const [entry] = (await c.services.audit.list()).filter((e) => e.action === "stock.adjust");
  assert.equal(entry.integrity, true);
  assert.deepEqual(entry.details, { before: 30, after: 35, delta: 5, reason: "Conteo físico" });
  c.repos.audit.tamper(entry.id, { details: { ...entry.details, after: 999 } });
  const [tampered] = (await c.services.audit.list()).filter((e) => e.id === entry.id);
  assert.equal(tampered.integrity, false);
});

test("inventario: nunca queda negativo y el producto exige una categoria existente", async () => {
  const c = await newContainer();
  const ctx = await loginAs(c, "admin");
  await assert.rejects(c.services.productAdmin.adjustStock(ctx, "edicion-limitada", { delta: -5, reason: "Merma" }), ConflictError);
  const base = { id: "nuevo-prod", name: "Nuevo", description: "Desc", price: 1000, emoji: "🆕", color: "#000000", active: true };
  await assert.rejects(c.services.productAdmin.create(ctx, { ...base, categoryId: "inexistente" }), ValidationError);
  const created = await c.services.productAdmin.create(ctx, { ...base, categoryId: "cafe" });
  assert.equal(created.stock, 0);
  await assert.rejects(c.services.productAdmin.create(ctx, { ...base, categoryId: "cafe" }), /Ya existe/);
});

test("usuarios: nadie cambia su propia cuenta y siempre queda un admin activo", async () => {
  const c = await newContainer();
  const admin = await loginAs(c, "admin");
  await assert.rejects(c.services.userAdmin.update(admin, admin.user.id, { role: "cliente" }), /tu propia cuenta/);

  // Con dos administradores, uno puede degradar al otro
  const [operador] = await c.services.userAdmin.list({ role: "operador" });
  await c.services.userAdmin.update(admin, operador.id, { role: "admin" });
  await c.services.userAdmin.update(admin, operador.id, { role: "operador" });

  // Con uno solo, la regla lo impide aunque quien actua este autorizado
  const otherAdmin = { ...admin, user: { ...admin.user, id: "otro-admin-autorizado" } };
  await assert.rejects(c.services.userAdmin.update(otherAdmin, admin.user.id, { active: false }), (err) => err instanceof ForbiddenError && /al menos un administrador/.test(err.message));
});

test("cambiar el rol revoca las sesiones del afectado y lo anuncia por su canal privado", async () => {
  const c = await newContainer();
  const admin = await loginAs(c, "admin");
  const operador = await loginAs(c, "operador");
  const events = captureEvents(c);
  await c.services.userAdmin.update(admin, operador.user.id, { role: "cliente" });
  assert.equal(await c.services.sessions.resolve(operador.token), null);
  const revoked = events.find((e) => e.event === "session.revoked");
  assert.deepEqual(revoked.payload.channels, [`s:${operador.session.rtChannel}`]);
});

test("resumen del panel: stock bajo y alertas de seguridad de 24 h", async () => {
  const c = await newContainer();
  await c.services.auth.login({ user: null, session: null, ip: "10.9.9.9" }, { email: "cliente@tienda.test", password: "mala-clave-123" }).catch(() => {});
  const summary = await c.services.stats.summary();
  assert.ok(summary.lowStock.some((p) => p.id === "edicion-limitada"));
  assert.equal(summary.security.loginFailures24h, 1);
  assert.equal(summary.byStatus.entregado, 1);
});
