// Proveedores globales, en orden de dependencia: router > sesion > realtime > alertas > carrito.
import { BrowserRouter } from "react-router-dom";
import { RealtimeProvider } from "../shared/realtime/RealtimeProvider.jsx";
import { AuthProvider, SessionRevocationListener, useAuth } from "../features/auth/index.js";
import { AlertsProvider } from "../features/alerts/index.js";
import { CartProvider } from "../features/cart/index.js";

/** Realtime de la sesion actual: escucha su canal privado y cierra la sesion si el servidor la revoca. */
function SessionRealtime({ children }) {
  const { realtimeChannel } = useAuth();
  return (
    <RealtimeProvider privateChannel={realtimeChannel}>
      <SessionRevocationListener />
      {children}
    </RealtimeProvider>
  );
}

export function AppProviders({ children }) {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SessionRealtime>
          <AlertsProvider>
            <CartProvider>
              {children}
            </CartProvider>
          </AlertsProvider>
        </SessionRealtime>
      </AuthProvider>
    </BrowserRouter>
  );
}
