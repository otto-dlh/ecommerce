// Alertas en vivo de la sesion: llegan por el canal privado (evento "alert"), se agrupan si se
// repiten y se guardan en sessionStorage para no perderlas al recargar (se borran al cerrar la pestana
// o la sesion).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRealtimeEvent } from "../../shared/realtime/RealtimeProvider.jsx";
import { useAuth } from "../auth/index.js";

const MAX_ALERTS = 30;
const MAX_TOASTS = 3;
const GROUP_WINDOW_MS = 60_000;
/** Tiempo en pantalla por severidad; las criticas se quedan hasta que alguien las cierre. */
const TOAST_MS = { info: 6000, success: 6000, warning: 10000, critical: null };

const AlertsCtx = createContext(null);

// sessionStorage puede no estar disponible (modo privado, cuota): las alertas siguen en memoria
const storageKey = (userId) => `alerts:${userId}`;
const stored = {
  read(userId) {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(storageKey(userId)) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },
  write(userId, alerts) {
    try { sessionStorage.setItem(storageKey(userId), JSON.stringify(alerts)); } catch { /* solo en memoria */ }
  },
  remove(userId) {
    try { sessionStorage.removeItem(storageKey(userId)); } catch { /* nada que borrar */ }
  },
};

/** Suma una alerta nueva o agrupa la repeticion reciente de la misma clave. */
function addAlert(list, incoming) {
  const now = Date.parse(incoming.at) || Date.now();
  const previous = list.find((a) => a.key === incoming.key && now - Date.parse(a.at) < GROUP_WINDOW_MS);
  const merged = previous ? { ...incoming, id: previous.id, count: previous.count + 1, read: false } : { ...incoming, count: 1, read: false };
  return [merged, ...list.filter((a) => a.id !== merged.id)].slice(0, MAX_ALERTS);
}

export function AlertsProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [alerts, setAlerts] = useState([]);
  const [toastIds, setToastIds] = useState([]);
  const timers = useRef(new Map());
  // Copias sincronicas: dos alertas en el mismo instante se agrupan sobre la lista ya actualizada
  const latest = useRef(alerts);
  const owner = useRef(null);

  const replaceAlerts = useCallback((next, { persist = true } = {}) => {
    latest.current = next;
    setAlerts(next);
    if (persist && owner.current) stored.write(owner.current, next);
  }, []);

  useEffect(() => {
    // Al cerrar sesion o cambiar de cuenta no quedan alertas de la persona anterior en la pestana
    if (owner.current && owner.current !== userId) stored.remove(owner.current);
    owner.current = userId;
    replaceAlerts(userId ? stored.read(userId) : [], { persist: false });
    setToastIds([]);
  }, [userId, replaceAlerts]);

  const dismissToast = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToastIds((list) => list.filter((t) => t !== id));
  }, []);

  const showToast = useCallback((alert) => {
    clearTimeout(timers.current.get(alert.id));
    setToastIds((list) => [alert.id, ...list.filter((t) => t !== alert.id)].slice(0, MAX_TOASTS));
    const ms = TOAST_MS[alert.severity];
    if (ms) timers.current.set(alert.id, setTimeout(() => dismissToast(alert.id), ms));
  }, [dismissToast]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useRealtimeEvent("alert", (incoming) => {
    if (!userId || !incoming?.id) return;
    const next = addAlert(latest.current, incoming);
    replaceAlerts(next);
    showToast(next[0]);
  });

  const value = useMemo(() => ({
    alerts,
    toasts: toastIds.map((id) => alerts.find((a) => a.id === id)).filter(Boolean),
    unread: alerts.filter((a) => !a.read).length,
    dismissToast,
    markAllRead: () => replaceAlerts(latest.current.map((a) => (a.read ? a : { ...a, read: true }))),
    clear: () => { replaceAlerts([]); setToastIds([]); },
  }), [alerts, toastIds, dismissToast, replaceAlerts]);

  return <AlertsCtx.Provider value={value}>{children}</AlertsCtx.Provider>;
}

export const useAlerts = () => useContext(AlertsCtx);
