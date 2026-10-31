// Puertos del modulo de notificaciones: publicacion de eventos en tiempo real.

/**
 * @typedef {object} RealtimePublisher
 * @property {(channels: string[], event: string, payload: object) => Promise<void>} publish
 */

export const NOTIFICATION_PORTS = Object.freeze({
  realtime: ["publish"],
});
