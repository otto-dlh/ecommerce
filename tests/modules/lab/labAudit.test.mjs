// El laboratorio de seguridad deja constancia de TODAS sus pruebas en la bitacora, incluidas las que
// no pasan por nuestra API (ataques directos a InsForge y comprobaciones dentro del navegador).
// Lo que llega del navegador es dato, no verdad: solo se acepta una clave de la lista blanca.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { newContainer, anonCtx, loginAs } from "../../helpers.mjs";
import { LAB_TESTS, LAB_ACTION } from "../../../server/modules/lab/index.mjs";
import { ValidationError, TooManyRequestsError } from "../../../server/shared/domain/errors.mjs";
import { eventLabel, isIncident } from "../../../src/features/admin/auditLabels.js";

const ATTACKS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../src/features/security-lab/attacks");
const attackFiles = () => readdirSync(ATTACKS_DIR).filter((f) => f.endsWith(".js") && !["index.js", "helpers.js"].includes(f));
const labRuns = async (c) => (await c.services.audit.list({ limit: 300 })).filter((e) => e.action === LAB_ACTION);

test("cada prueba del laboratorio queda registrada en la bitácora", async () => {
  const c = await newContainer();
  const keys = Object.keys(LAB_TESTS);
  for (const key of keys) {
    await c.services.lab.reportRun(anonCtx(), { test: key, result: "bloqueado", status: 200 });
  }
  const runs = await labRuns(c);
  assert.equal(runs.length, keys.length, "una entrada por prueba ejecutada");
  assert.deepEqual([...runs.map((e) => e.target.replace("lab:", ""))].sort(), [...keys].sort());
  assert.ok(runs.every((e) => e.outcome === "ok"), "un ataque bloqueado no es un incidente");
  assert.ok(runs.every((e) => e.integrity), "los registros del laboratorio también van firmados");
});

test("el catálogo del servidor y las pruebas del navegador no se separan", () => {
  const files = attackFiles();
  const keysInFiles = files.map((file) => {
    const found = /key:\s*"([^"]+)"/.exec(readFileSync(join(ATTACKS_DIR, file), "utf8"));
    assert.ok(found, `${file} debe declarar su key para poder auditarse`);
    return found[1];
  });
  assert.deepEqual([...keysInFiles].sort(), Object.keys(LAB_TESTS).sort(), "toda prueba del laboratorio existe en LAB_TESTS");
  assert.equal(new Set(keysInFiles).size, keysInFiles.length, "las claves no se repiten");

  // El panel arma la etiqueta del evento con esta misma accion
  const labels = readFileSync(join(ATTACKS_DIR, "../../admin/auditLabels.js"), "utf8");
  assert.ok(labels.includes(`LAB_ACTION = "${LAB_ACTION}"`), "el panel debe usar la misma accion que el servidor");

  // Toda prueba del directorio se ejecuta de verdad (esta en la lista del laboratorio)
  const index = readFileSync(join(ATTACKS_DIR, "index.js"), "utf8");
  const missing = files.map((f) => f.replace(".js", "")).filter((name) => !index.includes(name));
  assert.deepEqual(missing, [], "pruebas que existen pero no se ejecutan");
});

test("una prueba que NO bloquea el ataque queda como incidente", async () => {
  const c = await newContainer();
  await c.services.lab.reportRun(anonCtx(), { test: "precio-manipulado", result: "no_bloqueado", status: 200 });
  const [entry] = await labRuns(c);
  assert.equal(entry.outcome, "failure");
  assert.equal(entry.details.resultado, "no_bloqueado");
});

test("una prueba omitida se registra igual, sin marcarse como incidente", async () => {
  const c = await newContainer();
  await c.services.lab.reportRun(anonCtx(), { test: "cabeceras-seguridad", result: "omitida", status: "—" });
  const [entry] = await labRuns(c);
  assert.equal(entry.outcome, "ok");
  assert.equal(entry.details.resultado, "omitida");
});

test("el navegador no puede escribir lo que quiera en la bitácora", async () => {
  const c = await newContainer();
  // Clave y resultado fuera de la lista blanca: se rechazan sin tocar la bitacora
  await assert.rejects(c.services.lab.reportRun(anonCtx(), { test: "inventada", result: "bloqueado" }), ValidationError);
  await assert.rejects(c.services.lab.reportRun(anonCtx(), { test: "precio-manipulado", result: "aprobado" }), ValidationError);
  await assert.rejects(c.services.lab.reportRun(anonCtx(), {}), ValidationError);
  assert.deepEqual(await labRuns(c), []);

  // El nombre y la amenaza los pone el servidor; el estado se sanea
  await c.services.lab.reportRun(anonCtx(), {
    test: "precio-manipulado",
    result: "bloqueado",
    status: "<script>alert(1)</script>",
    prueba: "Texto del atacante",
    amenaza: "T99",
  });
  const [entry] = await labRuns(c);
  assert.equal(entry.details.prueba, LAB_TESTS["precio-manipulado"].name);
  assert.equal(entry.details.amenaza, "T02");
  assert.ok(!entry.details.estado.includes("<"), "el estado no conserva marcas de HTML");
  assert.equal(entry.details.origen, "api");
});

test("el reporte del laboratorio tiene límite por IP: no sirve para inundar la bitácora", async () => {
  const c = await newContainer();
  const ctx = anonCtx();
  for (let i = 0; i < 120; i++) await c.services.lab.reportRun(ctx, { test: "xss-renderizado", result: "bloqueado" });
  await assert.rejects(c.services.lab.reportRun(ctx, { test: "xss-renderizado", result: "bloqueado" }), TooManyRequestsError);
});

test("la bitácora identifica a quien ejecuta el laboratorio con sesión iniciada", async () => {
  const c = await newContainer();
  const ctx = await loginAs(c, "cliente");
  await c.services.lab.reportRun(ctx, { test: "pedido-ajeno", result: "bloqueado", status: 404 });
  const [entry] = await labRuns(c);
  assert.equal(entry.actor.role, "cliente");
  assert.ok(entry.actor.email.includes("*"), "el correo va enmascarado");
});

test("el mensaje de la bitácora dice qué prueba fue y cómo salió", async () => {
  const c = await newContainer();
  await c.services.lab.reportRun(anonCtx(), { test: "precio-manipulado", result: "bloqueado", status: 200 });
  await c.services.lab.reportRun(anonCtx(), { test: "xss-renderizado", result: "no_bloqueado", status: "—" });
  await c.services.lab.reportRun(anonCtx(), { test: "ultima-unidad", result: "omitida", status: "—" });
  const porPrueba = Object.fromEntries((await labRuns(c)).map((e) => [e.target.replace("lab:", ""), e]));

  assert.equal(
    eventLabel(porPrueba["precio-manipulado"]),
    "T02 · Enviar precio manipulado en la cotización — bloqueado",
  );
  assert.equal(
    eventLabel(porPrueba["xss-renderizado"]),
    "T07 · Carga XSS renderizada — NO BLOQUEADO",
  );
  assert.equal(
    eventLabel(porPrueba["ultima-unidad"]),
    "T14 · Dos compras simultáneas de la última unidad — no se ejecutó",
  );

  // Solo el ataque que NO fue bloqueado es un incidente
  assert.equal(isIncident(porPrueba["xss-renderizado"]), true);
  assert.equal(isIncident(porPrueba["precio-manipulado"]), false);
  assert.equal(isIncident(porPrueba["ultima-unidad"]), false);
});
