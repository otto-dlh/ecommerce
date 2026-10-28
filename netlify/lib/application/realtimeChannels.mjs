// Entrega realtime compartida por el notificador y las alertas:
// convierte una audiencia (usuarios y/o permiso) en canales privados de sesion y publica.
import { rolesWith } from "../domain/permissions.mjs";
import { privateChannel } from "./sessionService.mjs";

export function createRealtimeChannels({ sessions, realtime, logger = console }) {
  async function publish(channels, event, payload) {
    if (channels.length === 0) return;
    try {
      await realtime.publish(channels, event, payload);
    } catch (err) {
      // Un aviso perdido no debe tumbar la operacion: la pantalla se pone al dia en la siguiente carga
      logger.error(JSON.stringify({ type: "realtime_publish_error", event, message: err.message }));
    }
  }

  /**
   * Canales privados de las sesiones de esos usuarios y/o de los roles que tienen el permiso.
   * @param {import("../domain/alerts.mjs").Audience} audience
   */
  async function resolve({ userIds = [], perm, excludeUserIds = [], excludeRtChannels = [] } = {}) {
    const roles = perm ? rolesWith(perm) : [];
    if (userIds.length === 0 && roles.length === 0) return [];
    const rtChannels = await sessions.listChannels({ userIds, roles, excludeUserIds });
    return rtChannels.filter((rt) => !excludeRtChannels.includes(rt)).map(privateChannel);
  }

  return { publish, resolve };
}
