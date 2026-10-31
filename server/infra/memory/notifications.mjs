// Publicador realtime en memoria: guarda lo publicado para que las pruebas lo verifiquen.
import { copy } from "./store.mjs";

export function createRealtimePublisher() {
  const published = [];
  return {
    published,
    async publish(channels, event, payload) { published.push({ channels: [...channels], event, payload: copy(payload) }); },
  };
}
