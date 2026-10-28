import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider, CartProvider } from "./state.jsx";
import { RealtimeProvider } from "./realtime/RealtimeProvider.jsx";
import { AlertsProvider } from "./alerts/AlertsProvider.jsx";
import App from "./App.jsx";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/space-grotesk";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <RealtimeProvider>
          <AlertsProvider>
            <CartProvider>
              <App />
            </CartProvider>
          </AlertsProvider>
        </RealtimeProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
