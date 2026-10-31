import { INSFORGE, SKIPPED } from "./helpers.js";

// T12 · Llamar una función interna de la base de datos
export const callDatabaseFunction = {
  id: "T12", name: "Llamar una función interna de la base de datos",
  goal: "Invocar directamente `adjust_stock` o `place_order` (funciones de PostgreSQL) con la clave pública para cambiar inventario o crear pedidos sin pasar por la API.",
  steps: [
    ["atacante", "Envía `POST /api/database/rpc/adjust_stock` a InsForge con la clave anónima y `p_delta: 100` para inflar el inventario."],
    ["servidor", "Las funciones de negocio se crearon con `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated`: PostgreSQL no deja ejecutarlas."],
    ["servidor", "Responde `permission denied for function`. Solo la API (con la clave de administrador) las ejecuta, y siempre después de validar permisos y datos."],
  ],
  expect: "Rechazo con `permission denied for function`; el inventario no cambia.",
  code: "migrations/*_tienda-schema.sql (secciones 7 y 8)",
  run: async () => {
    if (!INSFORGE.url) return SKIPPED;
    const r = await fetch(`${INSFORGE.url}/api/database/rpc/adjust_stock`, {
      method: "POST",
      headers: { Authorization: `Bearer ${INSFORGE.anonKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_product_id: "gorra", p_delta: 100 }),
    });
    const text = await r.text();
    const denied = !r.ok && /permission denied|42501/i.test(text);
    return { pass: denied, status: r.status, detail: denied ? "PostgreSQL negó la ejecución al rol anónimo" : `Respuesta inesperada: ${text.slice(0, 80)}` };
  },
};
