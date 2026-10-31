import { test } from "node:test";
import assert from "node:assert/strict";
import { ConfigError, loadConfig } from "../server/config.mjs";

const SECRET = "s".repeat(32);
const INSFORGE = { DATA_PROVIDER: "insforge", APP_SECRET: SECRET, INSFORGE_URL: "https://proyecto.us-east.insforge.app/", INSFORGE_API_KEY: "clave-admin" };

test("configuración válida: valores normalizados y congelados", () => {
  const config = loadConfig({ ...INSFORGE, ALLOWED_ORIGINS: "https://tienda.gt, https://www.tienda.gt" });
  assert.equal(config.dataProvider, "insforge");
  assert.deepEqual(config.insforge, { url: "https://proyecto.us-east.insforge.app", apiKey: "clave-admin", imageBucket: "product-images" });
  assert.deepEqual(config.allowedOrigins, ["https://tienda.gt", "https://www.tienda.gt"]);
  assert.ok(Object.isFrozen(config) && Object.isFrozen(config.insforge));
});

test("modo memoria: no exige las variables de InsForge", () => {
  const config = loadConfig({ DATA_PROVIDER: "memory", APP_SECRET: SECRET });
  assert.equal(config.insforge, null);
});

test("falla cerrado y nombra TODAS las variables con problemas, sin mostrar sus valores", () => {
  const leaked = "secreto-corto";
  try {
    loadConfig({ DATA_PROVIDER: "insforge", APP_SECRET: leaked, INSFORGE_URL: "http://inseguro.example.com" });
    assert.fail("debía fallar");
  } catch (err) {
    assert.ok(err instanceof ConfigError);
    for (const name of ["APP_SECRET", "INSFORGE_URL", "INSFORGE_API_KEY"]) assert.match(err.message, new RegExp(name));
    assert.equal(err.message.includes(leaked), false, "nunca expone el valor de un secreto");
    assert.equal(err.message.includes("inseguro.example.com"), false);
  }
});

test("rechaza proveedores desconocidos y orígenes CSRF incompletos", () => {
  assert.throws(() => loadConfig({ DATA_PROVIDER: "mysql", APP_SECRET: SECRET }), /DATA_PROVIDER/);
  assert.throws(() => loadConfig({ DATA_PROVIDER: "memory", APP_SECRET: SECRET, ALLOWED_ORIGINS: "tienda.gt" }), /ALLOWED_ORIGINS/);
  assert.throws(() => loadConfig({ DATA_PROVIDER: "memory", APP_SECRET: SECRET, ALLOWED_ORIGINS: "http://tienda.gt" }), /ALLOWED_ORIGINS/);
  assert.deepEqual(loadConfig({ DATA_PROVIDER: "memory", APP_SECRET: SECRET, ALLOWED_ORIGINS: "http://localhost:5173" }).allowedOrigins, ["http://localhost:5173"]);
});
