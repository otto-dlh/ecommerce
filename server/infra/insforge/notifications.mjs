// Publicador del modulo de notificaciones sobre InsForge Realtime.

/** Publica senales en canales realtime mediante una funcion del esquema (solo la API puede llamarla). */
export function createRealtimePublisher(db) {
  return {
    async publish(channels, event, payload) {
      if (channels.length === 0) return;
      await db.rpc("rt_publish_many", { p_channels: channels, p_event: event, p_payload: payload });
    },
  };
}
