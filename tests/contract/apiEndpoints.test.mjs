// Contrato frontend ↔ servidor: cada endpoint del catalogo del navegador (src/shared/api/endpoints.js)
// debe existir en el router del servidor con el mismo metodo. Si alguien cambia una ruta en un lado
// y no en el otro, esta prueba falla antes del despliegue.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ENDPOINTS, buildUrl } from "../../src/shared/api/endpoints.js";
import { registerRoutes } from "../../server/bootstrap/routes.mjs";
import { config as sandboxConfig } from "../../netlify/functions/sandbox-pay.mjs";

const normalize = (method, path) => `${method} ${path.replace(/:\w+/g, ":")}`;

function serverRoutes() {
  const routes = new Set();
  // Los controladores solo se registran: los servicios no se usan, basta un objeto vacio por servicio
  const services = new Proxy({}, { get: () => ({}) });
  registerRoutes({ add: (method, path) => routes.add(normalize(method, path)) }, services);
  routes.add(normalize("POST", sandboxConfig.path)); // pasarela simulada: su propia funcion
  return routes;
}

const frontendEndpoints = () => Object.entries(ENDPOINTS).flatMap(([module, endpoints]) =>
  Object.entries(endpoints).map(([name, { method, path }]) => ({ id: `${module}.${name}`, method, path })));

test("cada endpoint que usa el navegador existe en el servidor con el mismo método", () => {
  const routes = serverRoutes();
  const missing = frontendEndpoints().filter(({ method, path }) => !routes.has(normalize(method, path))).map(({ id, method, path }) => `${id}: ${method} ${path}`);
  assert.deepEqual(missing, []);
});

test("el catálogo no repite rutas (una sola definición por endpoint)", () => {
  const keys = frontendEndpoints().map(({ method, path }) => normalize(method, path));
  assert.equal(new Set(keys).size, keys.length);
});

test("los parámetros de ruta siempre se codifican: un id no puede alterar la ruta llamada", () => {
  assert.equal(ENDPOINTS.sales.order.url({ id: "../admin/users" }), "/api/orders/..%2Fadmin%2Fusers");
  assert.equal(ENDPOINTS.sales.updateCoupon.url({ code: "A B/C" }), "/api/admin/coupons/A%20B%2FC");
  assert.throws(() => ENDPOINTS.sales.order.url({}), /Falta el parámetro "id"/);
});

test("la consulta omite valores vacíos y codifica el resto", () => {
  assert.equal(buildUrl("/api/products", {}, { q: "", category: undefined, sort: "relevancia" }), "/api/products?sort=relevancia");
  assert.equal(ENDPOINTS.catalog.products.url({}, { q: "' OR 1=1 --" }), "/api/products?q=%27+OR+1%3D1+--");
});
