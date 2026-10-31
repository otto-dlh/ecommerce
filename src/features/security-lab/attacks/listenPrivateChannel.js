import { SKIPPED } from "./helpers.js";

// T04 · Escuchar el canal privado de otra sesión
export const listenPrivateChannel = {
  id: "T04", name: "Escuchar el canal privado de otra sesión",
  goal: "Suscribirse por WebSocket a los avisos privados de otra persona (sus pedidos, avisos del panel) adivinando el nombre de su canal.",
  steps: [
    ["atacante", "Abre un socket realtime anónimo y pide unirse a `s:<id inventado>`, como si fuera el canal privado de otra sesión."],
    ["servidor", "La política RLS de `realtime.channels` llama a `rt_session_channel_active`: el canal solo vale si pertenece a una sesión vigente de una cuenta activa."],
    ["servidor", "El id del canal es aleatorio de 128 bits y distinto del token de sesión: adivinarlo es inviable. Responde «Not authorized»."],
    ["servidor", "Aun si alguien entrara, los avisos son señales (ids y estados) sin datos personales: el detalle siempre se pide a la API, que vuelve a autorizar."],
  ],
  expect: "Suscripción rechazada.",
  code: "migrations/*_tienda-schema.sql (sección 8) · server/modules/notifications/application/notifier.mjs",
  run: async ({ realtime }) => {
    if (!realtime.enabled) return SKIPPED;
    const fakeChannel = `s:${crypto.randomUUID().replaceAll("-", "").slice(0, 22)}`;
    const joined = await realtime.subscribe(fakeChannel);
    if (joined) realtime.unsubscribe(fakeChannel);
    return { pass: !joined, status: "WS", detail: joined ? "¡El servidor aceptó un canal inventado!" : "El servidor rechazó el canal: no pertenece a ninguna sesión vigente" };
  },
};
