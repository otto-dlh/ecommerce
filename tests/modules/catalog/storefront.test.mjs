// Busqueda publica del catalogo (T08): el texto se compara literalmente y nunca arma una consulta.
// La carga de inyeccion no cambia el resultado, pero el intento si queda en la bitacora.
import { test } from "node:test";
import assert from "node:assert/strict";
import { newContainer, anonCtx } from "../../helpers.mjs";
import { looksLikeInjection } from "../../../server/modules/catalog/index.mjs";

const search = (c, q) => c.services.catalog.listProducts({ ...anonCtx(), query: new URLSearchParams({ q }) });
const suspicious = async (c) => (await c.services.audit.list()).filter((e) => e.action === "search.suspicious");

test("T08: una busqueda con carga de inyeccion no devuelve nada y queda auditada", async () => {
  const c = await newContainer();
  const found = await search(c, "' OR 1=1 --");
  assert.deepEqual(found, [], "se busco la cadena tal cual");
  const [entry] = await suspicious(c);
  assert.ok(entry, "el intento queda registrado");
  assert.equal(entry.details.busqueda, "' or 1=1 --");
  assert.equal(entry.outcome, "rejected");
});

test("una busqueda normal encuentra productos y no deja ruido en la bitacora", async () => {
  const c = await newContainer();
  assert.ok((await search(c, "huehuetenango")).length > 0, "la busqueda normal sigue funcionando");
  await search(c, "jade tallado");
  await search(c, "camisa 100% algodon");
  assert.deepEqual(await suspicious(c), [], "solo se audita lo que parece un ataque");
});

test("las senales de inyeccion cubren SQL, NoSQL, XSS y rutas", () => {
  for (const q of ["' or 1=1 --", "union select * from app_users", "<img src=x onerror=alert(1)>", "$where: 1", "../../etc/passwd", "; drop table products"]) {
    assert.ok(looksLikeInjection(q), q);
  }
  for (const q of ["cafe de huehuetenango", "mochila", "taza 350 ml", ""]) {
    assert.ok(!looksLikeInjection(q), q);
  }
});
