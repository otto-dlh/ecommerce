import { ENDPOINTS, request } from "../../../shared/api/index.js";
import { can } from "../../../shared/lib/permissions.js";

// T04 · Escalar privilegios: listar usuarios como cliente
export const listUsersAsClient = {
  id: "T04", name: "Escalar privilegios: listar usuarios como cliente",
  goal: "Usar una función de administrador llamando directo a la API, aunque el menú no le muestre esa opción a un cliente.",
  steps: [
    ["atacante", "Con sesión de cliente, llama directo a `GET /api/admin/users`, que devuelve todas las cuentas con su rol. No pasa por la interfaz: ocultar el botón del menú no protege nada si la API no verifica."],
    ["servidor", "El router identifica la ruta, que declara el permiso `users:read` (solo administrador y auditor)."],
    ["servidor", "Comprueba la sesión (sin ella, `401`) y luego `can(usuario, \"users:read\")` con el rol guardado en el servidor; nada de lo que envía el navegador puede cambiarlo."],
    ["bitacora", "El rol cliente no tiene ese permiso: registra «Acceso denegado»."],
    ["servidor", "Responde `403` sin llegar a ejecutar la ruta: no se lee ningún usuario."],
  ],
  expect: "`403` como cliente u operador, `401` sin sesión y `200` como administrador o auditor (solo lectura).",
  evidence: "Administración → Auditoría: «Acceso denegado»",
  code: "server/http/pipeline.mjs · server/modules/identity/domain/permissions.mjs",
  run: async ({ user }) => {
    const r = await request(ENDPOINTS.identity.users.url());
    if (can(user, "users:read")) return { pass: r.status === 200, status: r.status, detail: "Tu rol puede consultar usuarios: acceso legítimo" };
    return { pass: [401, 403].includes(r.status), status: r.status, detail: r.data.error };
  },
};
