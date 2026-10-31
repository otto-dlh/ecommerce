// Alertas en vivo por rol: escucha los hechos del bus, aplica las reglas del dominio
// (domain/alerts.mjs) y publica el evento "alert" en los canales privados de quien debe actuar.
// Las repeticiones del mismo hecho se agrupan durante una ventana (p. ej. durante un ataque),
// asi un atacante no puede usar las alertas para inundar al personal ni multiplicar el costo.
import { randomUUID } from "node:crypto";
import { auditAlerts, orderAlerts, reviewAlerts, sessionAlerts, stockAlerts } from "../domain/alerts.mjs";

export const ALERT_EVENT = "alert";
const DEFAULT_THROTTLE_MS = 30_000;
const MAX_TRACKED_KEYS = 500;

/** Una alerta por clave en cada ventana (por instancia de la funcion). */
export function createThrottle(windowMs, now) {
  const lastSent = new Map();
  function prune(t) {
    if (lastSent.size <= MAX_TRACKED_KEYS) return;
    for (const [key, at] of lastSent) if (t - at >= windowMs) lastSent.delete(key);
  }
  return {
    isOpen(key) {
      const last = lastSent.get(key);
      return last === undefined || now() - last >= windowMs;
    },
    /** Se marca solo lo que de verdad se entrego: una alerta sin destinatarios no silencia la siguiente. */
    mark(key) {
      const t = now();
      prune(t);
      lastSent.set(key, t);
    },
  };
}

export function createAlertService({ events, products, channels, now = Date.now, throttleMs = DEFAULT_THROTTLE_MS }) {
  const throttle = createThrottle(throttleMs, now);

  /** @param {import("../domain/alerts.mjs").AlertDraft[]} drafts */
  async function deliver(drafts) {
    for (const { kind, severity, key, data, to } of drafts) {
      if (!throttle.isOpen(key)) continue;
      const targets = await channels.resolve(to);
      if (targets.length === 0) continue;
      throttle.mark(key);
      await channels.publish(targets, ALERT_EVENT, { id: randomUUID(), kind, severity, key, at: new Date(now()).toISOString(), data });
    }
  }

  const handlers = {
    "order.updated": (change) => deliver(orderAlerts(change)),
    "stock.changed": async ({ productIds, decreased, actorId }) => {
      if (!decreased) return;
      await deliver(stockAlerts(await products.findByIds(productIds), { actorId }));
    },
    "review.created": (review) => deliver(reviewAlerts(review)),
    "session.started": (session) => deliver(sessionAlerts(session)),
    "audit.recorded": (entry) => deliver(auditAlerts(entry)),
  };

  function attach() {
    for (const [event, handler] of Object.entries(handlers)) events.on(event, handler);
  }

  return { attach };
}
