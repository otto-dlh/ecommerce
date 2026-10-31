// Cliente realtime del navegador. Interfaz minima que usan los hooks; solo este archivo conoce el SDK.
// Cambiar de proveedor realtime = escribir otro adaptador con la misma interfaz.
//
// @typedef {object} RealtimeClient
// @property {(channel: string) => Promise<boolean>} subscribe
// @property {(channel: string) => void} unsubscribe
// @property {(event: string, handler: (payload: object) => void) => () => void} on   devuelve la funcion para dejar de escuchar
// @property {() => void} disconnect
// @property {(channel: string, event: string, payload: object) => Promise<{ accepted: boolean, code?: string }>} attemptPublish
//           solo para el laboratorio: demuestra que el navegador NO puede publicar eventos
// @property {boolean} enabled
import { createClient } from "@insforge/sdk";

const PUBLISH_VERDICT_MS = 3000;

/** Sin configuracion: la app funciona igual, solo que sin actualizaciones en vivo. */
function createDisabledClient() {
  return {
    enabled: false,
    subscribe: async () => false,
    unsubscribe() {},
    on: () => () => {},
    disconnect() {},
    attemptPublish: async () => ({ accepted: false, code: "REALTIME_DISABLED" }),
  };
}

/** Adaptador InsForge: socket anonimo (clave publica); la RLS del servidor decide a que canales entra. */
function createInsforgeRealtimeClient({ url, anonKey }) {
  // En esta tienda InsForge solo se usa para escuchar eventos, nunca para iniciar sesion
  const { realtime } = createClient({ baseUrl: url, anonKey, auth: { detectOAuthCallback: false } });
  return {
    enabled: true,
    async subscribe(channel) {
      const response = await realtime.subscribe(channel);
      return Boolean(response.ok);
    },
    unsubscribe: (channel) => realtime.unsubscribe(channel),
    on(event, handler) {
      realtime.on(event, handler);
      return () => realtime.off(event, handler);
    },
    disconnect: () => realtime.disconnect(),
    /** El servidor responde con un evento de error si rechaza la publicacion; sin error en 3 s = aceptada. */
    attemptPublish(channel, event, payload) {
      return new Promise((resolve) => {
        const finish = (verdict) => {
          clearTimeout(timer);
          realtime.off("error", onError);
          resolve(verdict);
        };
        const onError = (error) => finish({ accepted: false, code: error?.code ?? "ERROR" });
        const timer = setTimeout(() => finish({ accepted: true }), PUBLISH_VERDICT_MS);
        realtime.on("error", onError);
        realtime.publish(channel, event, payload).catch((err) => finish({ accepted: false, code: err.message }));
      });
    },
  };
}

export function createRealtimeClient({ url, anonKey } = {}) {
  return url && anonKey ? createInsforgeRealtimeClient({ url, anonKey }) : createDisabledClient();
}
