import { ENDPOINTS, request } from "../../../shared/api/index.js";

// T13 · Petición de cambio sin token CSRF
export const missingCsrfToken = {
  id: "T13", name: "Petición de cambio sin token CSRF",
  goal: "Que una página maliciosa haga cambios en la cuenta de la víctima aprovechando que tiene la sesión abierta (CSRF).",
  steps: [
    ["atacante", "Con la sesión iniciada, envía `POST /api/addresses` para guardar una dirección nueva, pero sin la cabecera `X-CSRF-Token`, como haría una página maliciosa que no conoce el token."],
    ["navegador", "Adjunta la cookie de sesión. En un ataque real desde otro sitio no lo haría: la cookie es `SameSite=Strict`."],
    ["servidor", "Como la petición cambia datos, `assertCsrfSafe` se ejecuta antes de leer el cuerpo."],
    ["servidor", "Revisa `Origin` y `Sec-Fetch-Site`: aquí coinciden con la tienda, así que pasa. Un origen ajeno recibiría `403` «Origen no permitido»."],
    ["servidor", "Revisa que el `Content-Type` sea `application/json`, que un formulario HTML de otro sitio no puede enviar sin permiso CORS (`415`): pasa."],
    ["servidor", "Compara `X-CSRF-Token` con el token guardado en la sesión del servidor: no viene."],
    ["bitacora", "Registra «Petición sin token CSRF»."],
    ["servidor", "Responde `403` sin crear la dirección."],
  ],
  expect: "`403` «Token CSRF inválido o ausente». Sin sesión responde `401`.",
  evidence: "Administración → Auditoría: «Petición sin token CSRF»",
  code: "server/http/csrf.mjs · server/http/pipeline.mjs",
  run: async ({ user }) => {
    const r = await request(ENDPOINTS.customers.createAddress.url(), { method: "POST", csrf: false, body: { name: "CSRF", line1: "Calle falsa 123", city: "X", phone: "55555555" } });
    if (!user) return { pass: r.status === 401, status: r.status, detail: "Sin sesión: 401 (inicia sesión para probar CSRF)" };
    return { pass: r.status === 403, status: r.status, detail: r.data.error };
  },
};
