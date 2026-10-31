import { ENDPOINTS, request } from "../../../shared/api/index.js";
import { can } from "../../../shared/lib/permissions.js";
import { json } from "./helpers.js";

// T04 · Escribir sin permiso (auditor ajusta inventario)
export const writeWithoutPermission = {
  id: "T04", name: "Escribir sin permiso (auditor ajusta inventario)",
  goal: "Que una cuenta de solo lectura (auditor) o un cliente modifique el inventario llamando directamente a la API.",
  steps: [
    ["atacante", "Con sesión de auditor (o de cliente), envía `POST /api/admin/products/gorra/stock` para ajustar el inventario."],
    ["servidor", "La ruta exige el permiso `inventory:write`, que solo tienen el administrador y el operador; el auditor solo recibe permisos de lectura."],
    ["bitacora", "Registra «Acceso denegado» con el permiso que faltó."],
    ["servidor", "Responde `403` sin ejecutar nada."],
  ],
  expect: "`403` como auditor o cliente, `401` sin sesión. Con administrador u operador el permiso existe (acceso legítimo).",
  evidence: "Administración → Auditoría: «Acceso denegado»",
  code: "server/modules/catalog/http/catalogAdminRoutes.mjs · server/modules/identity/domain/permissions.mjs",
  run: async ({ user }) => {
    // Cuerpo invalido a proposito: aun con permiso, nada se modifica (la validacion lo rechaza)
    const r = await request(ENDPOINTS.catalog.adjustStock.url({ id: "gorra" }), json({ delta: 0, reason: "lab" }));
    if (!user) return { pass: r.status === 401, status: r.status, detail: "Sin sesión: 401 (inicia sesión con una cuenta de rol auditor)" };
    if (can(user, "inventory:write")) return { pass: r.status === 400, status: r.status, detail: "Tu rol sí puede ajustar inventario (legítimo). Prueba con una cuenta de rol auditor" };
    return { pass: r.status === 403, status: r.status, detail: r.data.error };
  },
};
