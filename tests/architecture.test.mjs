// Pruebas de arquitectura: las reglas de dependencia dejan de ser una convencion y se verifican en cada `pnpm test`.
// Se analizan los imports reales (estaticos y dinamicos); los import() de JSDoc son solo tipos y se ignoran.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CODE = /\.(mjs|js|jsx)$/;

function filesIn(dir) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).flatMap((name) => {
    const rel = posix.join(dir, name);
    return statSync(join(ROOT, rel)).isDirectory() ? filesIn(rel) : CODE.test(name) ? [rel] : [];
  });
}

/** Codigo sin comentarios de bloque ni de linea completa (ahi viven los tipos JSDoc). */
const codeOf = (file) => readFileSync(join(ROOT, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const IMPORT = /(?:^|\n)\s*(?:import|export)\b[^;"']*?\bfrom\s*["']([^"']+)["']|(?:^|\n)\s*import\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;

/** Imports de un archivo: { spec, target } con target = ruta del proyecto (relativos) o nombre de paquete. */
function importsOf(file) {
  return [...codeOf(file).matchAll(IMPORT)].map((m) => {
    const spec = m[1] ?? m[2] ?? m[3];
    const target = spec.startsWith(".") ? posix.normalize(posix.join(posix.dirname(file), spec)) : spec;
    return { spec, target };
  });
}

const SERVER = filesIn("server");
const TOOLING = [...filesIn("tooling"), ...filesIn("scripts")];
const moduleOf = (path) => /^server\/modules\/([^/]+)\//.exec(path)?.[1] ?? null;
const violations = (files, rule) => files.flatMap((file) => importsOf(file).filter(({ target }) => rule(file, target)).map(({ spec }) => `${file} → ${spec}`));

test("el dominio es puro: solo importa su propio dominio o el dominio compartido", () => {
  const domain = SERVER.filter((f) => /^server\/modules\/[^/]+\/domain\//.test(f));
  assert.ok(domain.length > 0);
  const bad = violations(domain, (file, target) => !(target.startsWith(`server/modules/${moduleOf(file)}/domain/`) || target.startsWith("server/shared/domain/")));
  assert.deepEqual(bad, []);
});

test("entre módulos solo se importa la API pública (index.mjs)", () => {
  const outside = (file, target) => moduleOf(target) && moduleOf(target) !== moduleOf(file);
  const bad = violations([...SERVER, ...TOOLING, ...filesIn("netlify")], (file, target) => outside(file, target) && !target.endsWith(`/modules/${moduleOf(target)}/index.mjs`));
  assert.deepEqual(bad, []);
});

test("los módulos no dependen entre sí en ciclo", () => {
  const edges = new Map();
  for (const file of SERVER.filter(moduleOf)) {
    for (const { target } of importsOf(file)) {
      const to = moduleOf(target);
      if (to && to !== moduleOf(file)) (edges.get(moduleOf(file)) ?? edges.set(moduleOf(file), new Set()).get(moduleOf(file))).add(to);
    }
  }
  const cycles = [];
  const visit = (node, path) => {
    if (path.includes(node)) return cycles.push([...path.slice(path.indexOf(node)), node].join(" → "));
    for (const next of edges.get(node) ?? []) visit(next, [...path, node]);
  };
  for (const node of edges.keys()) visit(node, []);
  assert.deepEqual([...new Set(cycles)], []);
});

test("módulos y núcleo compartido no conocen la infraestructura, la composición ni el hosting", () => {
  const inner = SERVER.filter((f) => f.startsWith("server/modules/") || f.startsWith("server/shared/"));
  const forbidden = ["server/infra/", "server/bootstrap/", "server/http/", "server/sandbox-gateway/", "netlify/"];
  const bad = violations(inner, (_, target) => forbidden.some((prefix) => target.startsWith(prefix)) || target.startsWith("@insforge/"));
  assert.deepEqual(bad, []);
});

test("el núcleo compartido no depende de ningún módulo", () => {
  const bad = violations(SERVER.filter((f) => f.startsWith("server/shared/")), (_, target) => target.startsWith("server/modules/"));
  assert.deepEqual(bad, []);
});

test("solo el adaptador de InsForge usa el SDK (y con él la clave de administrador)", () => {
  const files = [...SERVER, ...filesIn("src"), ...filesIn("netlify"), ...TOOLING];
  const bad = violations(files, (file, target) => target.startsWith("@insforge/") && !file.startsWith("server/infra/insforge/") && !file.startsWith("src/shared/realtime/"));
  assert.deepEqual(bad, []);
  // En el navegador solo se permite el cliente realtime (clave anonima); nunca el cliente administrador
  const browserAdmin = filesIn("src").filter((file) => /createAdminClient/.test(codeOf(file)));
  assert.deepEqual(browserAdmin, []);
});

test("solo server/config.mjs lee variables de entorno en el servidor", () => {
  const readers = SERVER.filter((file) => file !== "server/config.mjs" && /process\.env/.test(codeOf(file)));
  assert.deepEqual(readers, []);
});

test("el navegador nunca importa código del servidor, de Netlify ni de Node", () => {
  const bad = violations(filesIn("src"), (_, target) => ["server/", "netlify/", "tests/", "scripts/", "tooling/"].some((p) => target.startsWith(p)) || target.startsWith("node:"));
  assert.deepEqual(bad, []);
});

// ---- Frontend (src/) ----
const SRC = filesIn("src");
const featureOf = (path) => /^src\/features\/([^/]+)\//.exec(path)?.[1] ?? null;

test("frontend: shared/ y styles/ son genéricos (no importan features ni app)", () => {
  const generic = SRC.filter((f) => f.startsWith("src/shared/") || f.startsWith("src/styles/"));
  assert.ok(generic.length > 0);
  const bad = violations(generic, (_, target) => target.startsWith("src/features/") || target.startsWith("src/app/"));
  assert.deepEqual(bad, []);
});

test("frontend: entre features solo se importa la API pública (index.js)", () => {
  const outside = (file, target) => featureOf(target) && featureOf(target) !== featureOf(file);
  const bad = violations(SRC, (file, target) => outside(file, target) && !/^src\/features\/[^/]+\/index\.jsx?$/.test(target));
  assert.deepEqual(bad, []);
});

test("frontend: las rutas de la API solo se definen en shared/api/endpoints.js", () => {
  const offenders = SRC.filter((file) => file !== "src/shared/api/endpoints.js" && /["'`]\/(api|sandbox)\//.test(codeOf(file)));
  assert.deepEqual(offenders, []);
});

test("frontend: solo la capa de API usa el transporte HTTP; el resto importa shared/api/index.js", () => {
  const outsideLayer = SRC.filter((file) => !file.startsWith("src/shared/api/"));
  const bad = violations(outsideLayer, (_, target) => target.startsWith("src/shared/api/") && target !== "src/shared/api/index.js");
  assert.deepEqual(bad, []);
});

test("frontend: ninguna feature depende de app/ (solo app compone las features)", () => {
  const bad = violations(SRC.filter(featureOf), (_, target) => target.startsWith("src/app/"));
  assert.deepEqual(bad, []);
});

test("las funciones de Netlify son adaptadores: solo arrancan el servidor", () => {
  const allowed = ["server/bootstrap/", "server/http/", "server/sandbox-gateway/"];
  const functions = filesIn("netlify/functions");
  assert.ok(functions.length > 0);
  const bad = violations(functions, (_, target) => !allowed.some((prefix) => target.startsWith(prefix)));
  assert.deepEqual(bad, []);
  for (const file of functions) assert.ok(codeOf(file).split("\n").filter((l) => l.trim()).length <= 8, `${file} debe ser un adaptador delgado`);
});

test("cada módulo tiene su API pública (index.mjs)", () => {
  for (const name of readdirSync(join(ROOT, "server/modules"))) {
    assert.ok(existsSync(join(ROOT, "server/modules", name, "index.mjs")), `server/modules/${name}/index.mjs`);
  }
});
