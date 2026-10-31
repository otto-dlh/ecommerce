import { SKIPPED } from "./helpers.js";

// T09 · Publicar un aviso falso en vivo
export const publishFakeEvent = {
  id: "T09", name: "Publicar un aviso falso en vivo",
  goal: "Enviar desde el navegador un evento realtime falso (por ejemplo «cambió el precio» o «pedido pagado») para engañar a otros usuarios.",
  steps: [
    ["atacante", "Con el socket abierto, publica en el canal público `catalog` un evento `catalog.products` inventado."],
    ["servidor", "`realtime.messages` tiene RLS activado y ninguna política de INSERT: ningún cliente puede publicar."],
    ["servidor", "Responde `REALTIME_UNAUTHORIZED`. Los avisos reales solo los emite la API mediante `rt_publish_many`, que solo puede ejecutar el servidor."],
  ],
  expect: "Publicación rechazada (`REALTIME_UNAUTHORIZED`).",
  code: "migrations/*_tienda-schema.sql (sección 8) · src/shared/realtime/realtimeClient.js",
  run: async ({ realtime }) => {
    if (!realtime.enabled) return SKIPPED;
    const verdict = await realtime.attemptPublish("catalog", "catalog.products", { productIds: ["aviso-falso"] });
    return { pass: !verdict.accepted, status: "WS", detail: verdict.accepted ? "¡El servidor aceptó el evento!" : `Rechazado: ${verdict.code}` };
  },
};
