import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { localNetlifyFunctions } from "./scripts/vite-local-functions.mjs";

/** Origenes de InsForge permitidos: API/Storage por HTTPS y el WebSocket del realtime. */
function insforgeOrigins(url) {
  if (!url) return { https: [], wss: [] };
  const origin = new URL(url).origin;
  return { https: [origin], wss: [origin.replace(/^https:/, "wss:")] };
}

// CSP estricta de produccion (T07 / T13). Se genera en dist/_headers solo al compilar:
// en desarrollo Vite necesita un script en linea (React Refresh) y estilos inyectados,
// que esta politica bloquearia. `pnpm serve` sirve el build con la CSP aplicada.
// Solo se agrega el origen exacto del proyecto InsForge (sin comodines).
function buildCsp(insforgeUrl) {
  const insforge = insforgeOrigins(insforgeUrl);
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    ["img-src 'self' data:", ...insforge.https].join(" "),
    "font-src 'self'",
    ["connect-src 'self'", ...insforge.https, ...insforge.wss].join(" "),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function productionCsp(insforgeUrl) {
  return {
    name: "production-csp-headers",
    apply: "build",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "_headers", source: `/*\n  Content-Security-Policy: ${buildCsp(insforgeUrl)}\n` });
    },
  };
}

export default defineConfig(({ mode }) => {
  const { VITE_INSFORGE_URL } = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [react(), productionCsp(VITE_INSFORGE_URL), localNetlifyFunctions()],
    build: {
      // Sin source maps en produccion: no se publica el codigo fuente original
      sourcemap: false,
    },
  };
});
