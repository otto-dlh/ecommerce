import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCsp } from "../../tooling/vite/csp.mjs";

const directives = (csp) => Object.fromEntries(csp.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1)]));

test("CSP de producción: sin scripts ni estilos en línea, sin eval y sin marcos ajenos (T07 / T13)", () => {
  const csp = buildCsp("https://proyecto.us-east.insforge.app");
  assert.equal(/unsafe-inline|unsafe-eval|\*/.test(csp), false);
  const d = directives(csp);
  assert.deepEqual(d["script-src"], ["'self'"]);
  assert.deepEqual(d["style-src"], ["'self'"]);
  assert.deepEqual(d["frame-ancestors"], ["'none'"]);
  assert.deepEqual(d["object-src"], ["'none'"]);
});

test("CSP: solo el origen exacto de InsForge, por HTTPS y por el WebSocket del realtime", () => {
  const d = directives(buildCsp("https://proyecto.us-east.insforge.app/api/ruta"));
  assert.deepEqual(d["connect-src"], ["'self'", "https://proyecto.us-east.insforge.app", "wss://proyecto.us-east.insforge.app"]);
  assert.deepEqual(d["img-src"], ["'self'", "data:", "https://proyecto.us-east.insforge.app"]);
});

test("CSP sin InsForge configurado: solo el propio sitio", () => {
  const d = directives(buildCsp(undefined));
  assert.deepEqual(d["connect-src"], ["'self'"]);
});
