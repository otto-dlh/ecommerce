// Conexion realtime compartida por toda la app.
// - Siempre escucha el canal publico "catalog".
// - Con sesion iniciada, escucha ademas el canal privado de la sesion (lo entrega /api/auth/me).
// - "session.revoked" cierra la sesion en el navegador al instante.
import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../state.jsx";
import { createRealtimeClient } from "./realtimeClient.js";

export const CATALOG_CHANNEL = "catalog";
const DEFAULT_DEBOUNCE_MS = 300;

const RealtimeCtx = createContext(createRealtimeClient());

export function RealtimeProvider({ children }) {
  const { realtimeChannel, endSessionLocally } = useAuth();
  const client = useMemo(() => createRealtimeClient({ url: import.meta.env.VITE_INSFORGE_URL, anonKey: import.meta.env.VITE_INSFORGE_ANON_KEY }), []);

  useEffect(() => {
    client.subscribe(CATALOG_CHANNEL);
    return () => client.disconnect();
  }, [client]);

  useEffect(() => {
    if (!realtimeChannel) return undefined;
    client.subscribe(realtimeChannel);
    return () => client.unsubscribe(realtimeChannel);
  }, [client, realtimeChannel]);

  useEffect(() => client.on("session.revoked", (payload) => endSessionLocally(payload.reason)), [client, endSessionLocally]);

  return <RealtimeCtx.Provider value={client}>{children}</RealtimeCtx.Provider>;
}

export const useRealtimeClient = () => useContext(RealtimeCtx);

/** Escucha uno o varios eventos realtime mientras el componente este montado. */
export function useRealtimeEvent(events, handler) {
  const client = useRealtimeClient();
  const latest = useRef(handler);
  latest.current = handler;
  const key = [].concat(events).join("|");

  useEffect(() => {
    const stops = key.split("|").map((event) => client.on(event, (payload) => latest.current(payload, event)));
    return () => stops.forEach((stop) => stop());
  }, [client, key]);
}

/**
 * Recarga datos cuando llega alguno de los eventos (agrupando rafagas en una sola recarga).
 * `filter(payload)` permite ignorar eventos que no afectan a esta pantalla.
 */
export function useLiveRefresh(events, reload, { filter = () => true, debounceMs = DEFAULT_DEBOUNCE_MS } = {}) {
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  useRealtimeEvent(events, (payload) => {
    if (!filter(payload)) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(reload, debounceMs);
  });
}
