// "session.revoked" (canal privado de la sesion) cierra la sesion en el navegador al instante.
// Va dentro del RealtimeProvider; no dibuja nada.
import { useRealtimeEvent } from "../../shared/realtime/RealtimeProvider.jsx";
import { useAuth } from "./AuthProvider.jsx";

export function SessionRevocationListener() {
  const { endSessionLocally } = useAuth();
  useRealtimeEvent("session.revoked", (payload) => endSessionLocally(payload.reason));
  return null;
}
