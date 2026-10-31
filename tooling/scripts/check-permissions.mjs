// Verifica la matriz de permisos de los 4 roles contra la API en ejecucion.
// - Las rutas se toman del registro real de la API (http/routes) y lo esperado de domain/permissions.mjs,
//   asi la verificacion no duplica reglas.
// - Las solicitudes usan ids inexistentes o cuerpos invalidos: un rol autorizado recibe 400/404 (llego a la
//   validacion) y uno no autorizado recibe 403. Ninguna llamada modifica datos.
// - Usa las cuentas demo (una por rol), que solo existen con DATA_PROVIDER=memory: la base de datos real
//   no tiene cuentas con contrasenas conocidas.
// Uso: pnpm check:permissions [url]   (por defecto http://localhost:8888)
import { registerRoutes } from "../../server/bootstrap/routes.mjs";
import { can, ROLES } from "../../server/modules/identity/index.mjs";
import { DEMO_ACCOUNTS } from "../../server/bootstrap/seedData.mjs";

const BASE = process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:8888";
const PROBE_ID = "no-existe";
const PROBE_USER_ID = "00000000-0000-4000-8000-000000000000";

/** Primera cuenta demo de cada rol: [correo, contrasena]. */
const ACCOUNTS = Object.fromEntries(ROLES.map((role) => {
  const account = DEMO_ACCOUNTS.find((a) => a.role === role);
  return [role, [account.email, account.password]];
}));

/** Rutas protegidas por permiso, leidas del registro real (los controladores no se ejecutan). */
function protectedRoutes() {
  const routes = [];
  const services = new Proxy({}, { get: () => ({}) });
  registerRoutes({ add: (method, path, options) => options.perm && routes.push({ method, path, perm: options.perm, contentType: options.contentTypes?.[0] ?? "application/json" }) }, services);
  return routes;
}

// Firma PNG minima: pasa la validacion de tipo para que la respuesta dependa solo del permiso
const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const probeBody = (contentType) => (contentType.startsWith("image/") ? PNG_SIGNATURE : "{}");

const concretePath = (path) => path.replace("/users/:id", `/users/${PROBE_USER_ID}`).replace(/:\w+/g, PROBE_ID);

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok || data.mfaRequired) throw new Error(`No se pudo iniciar sesión como ${email}: ${data.error ?? "requiere MFA"}`);
  return { cookie: res.headers.get("set-cookie").split(";")[0], csrf: data.csrf, user: data.user };
}

async function probe(session, { method, path, contentType }) {
  const headers = { cookie: session.cookie, origin: BASE };
  if (method !== "GET") Object.assign(headers, { "content-type": contentType, "x-csrf-token": session.csrf });
  const res = await fetch(BASE + concretePath(path), { method, headers, body: method === "GET" ? undefined : probeBody(contentType) });
  return res.status;
}

const routes = protectedRoutes();
const rows = [];
let mismatches = 0;
for (const role of ROLES) {
  const session = await login(...ACCOUNTS[role]);
  for (const route of routes) {
    const status = await probe(session, route);
    const allowed = ![401, 403].includes(status);
    const expected = can({ role, active: true }, route.perm);
    if (allowed !== expected) mismatches++;
    rows.push({ rol: role, endpoint: `${route.method} ${route.path}`, permiso: route.perm, esperado: expected ? "permitido" : "denegado", http: status, ok: allowed === expected ? "✓" : "✗" });
  }
}

console.table(rows);
console.log(`${routes.length} endpoints × ${ROLES.length} roles = ${rows.length} comprobaciones · ${mismatches ? `${mismatches} DIFERENCIAS` : "sin diferencias"}`);
process.exit(mismatches ? 1 : 0);
