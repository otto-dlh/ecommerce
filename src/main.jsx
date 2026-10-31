import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/space-grotesk";
// Orden de la cascada: primero los estilos globales; despues cada modulo importa su hoja al final de
// sus imports, asi la hoja de un modulo siempre queda despues de la de sus dependencias
// (styles/ -> shared/ui -> features).
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import { AppProviders } from "./app/providers.jsx";
import App from "./app/App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>
);
