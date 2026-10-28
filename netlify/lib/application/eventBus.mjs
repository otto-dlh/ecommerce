// Bus de eventos de aplicacion (patron observador).
// Los casos de uso anuncian hechos ("order.updated"); otros modulos (p. ej. el notificador realtime)
// se suscriben sin que los casos de uso los conozcan. Un suscriptor que falla no rompe la operacion.

export function createEventBus({ logger = console } = {}) {
  const handlers = new Map();

  function on(event, handler) {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event).add(handler);
    return () => handlers.get(event).delete(handler);
  }

  async function emit(event, payload) {
    const targets = [...(handlers.get(event) ?? []), ...(handlers.get("*") ?? [])];
    const results = await Promise.allSettled(targets.map((handler) => handler(payload, event)));
    for (const result of results) {
      if (result.status === "rejected") {
        logger.error(JSON.stringify({ type: "event_handler_error", event, message: result.reason?.message }));
      }
    }
  }

  return { on, emit };
}
