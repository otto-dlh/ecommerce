// Estructura de la pagina: barra superior, avisos, pantalla de la ruta actual y pie de pagina.
import { AlertToasts } from "../features/alerts/index.js";
import { Header } from "./layout/Header.jsx";
import { SessionNotice } from "./layout/SessionNotice.jsx";
import { Footer } from "./layout/Footer.jsx";
import { AppRoutes } from "./routes.jsx";

export default function App() {
  return (
    <>
      <Header />
      <SessionNotice />
      <AlertToasts />
      <main className="container main">
        <AppRoutes />
      </main>
      <Footer />
    </>
  );
}
