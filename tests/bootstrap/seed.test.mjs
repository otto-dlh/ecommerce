import { test } from "node:test";
import assert from "node:assert/strict";
import { createMemoryAdapters } from "../../server/infra/memory/index.mjs";
import { seedInitialData, DEMO_ACCOUNTS } from "../../server/bootstrap/seedData.mjs";
import { ValidationError } from "../../server/shared/domain/errors.mjs";

const fastHash = async (password) => `hash:${password}`;

test("base de datos real: solo catálogo y administrador, nunca cuentas demo", async () => {
  const repos = createMemoryAdapters();
  await seedInitialData(repos, { adminPassword: "Una-Clave-Larga-2026", hash: fastHash });
  const users = await repos.users.list();
  assert.deepEqual(users.map((u) => [u.email, u.role]), [["admin@tienda.test", "admin"]]);
  assert.equal(users[0].passwordHash, "hash:Una-Clave-Larga-2026");
  assert.ok((await repos.products.list()).length > 0);
  assert.equal(await repos.orders.findById("demo-pedido-cliente2"), null, "sin pedido demo");
});

test("sin SEED_PASSWORD_ADMIN no se crea el administrador (falla cerrado), ni con una contraseña débil", async () => {
  await assert.rejects(seedInitialData(createMemoryAdapters(), { hash: fastHash }), /SEED_PASSWORD_ADMIN/);
  await assert.rejects(seedInitialData(createMemoryAdapters(), { adminPassword: "corta", hash: fastHash }), ValidationError);
});

test("si el administrador ya existe, sembrar de nuevo no pide contraseña ni lo modifica", async () => {
  const repos = createMemoryAdapters();
  await seedInitialData(repos, { adminPassword: "Una-Clave-Larga-2026", hash: fastHash });
  await seedInitialData(repos, { hash: fastHash });
  assert.equal((await repos.users.findByEmail("admin@tienda.test")).passwordHash, "hash:Una-Clave-Larga-2026");
});

test("desarrollo y pruebas (en memoria): una cuenta por rol y el pedido ajeno para IDOR", async () => {
  const repos = createMemoryAdapters();
  await seedInitialData(repos, { hash: fastHash, demoAccounts: true });
  assert.equal((await repos.users.list()).length, DEMO_ACCOUNTS.length);
  assert.ok(await repos.orders.findById("demo-pedido-cliente2"));
});
