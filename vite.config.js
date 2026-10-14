import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// CSP estricta de produccion (T07 / T13). Se genera en dist/_headers solo al compilar:
// en `netlify dev` Vite necesita un script en linea (React Refresh) y estilos inyectados,
// que esta politica bloquearia. `pnpm serve` sirve el build con la CSP aplicada.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

function productionCsp() {
  return {
    name: "production-csp-headers",
    apply: "build",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "_headers", source: `/*\n  Content-Security-Policy: ${CSP}\n` });
    },
  };
}

export default defineConfig({
  plugins: [react(), productionCsp()],
  build: {
    // Sin source maps en produccion: no se publica el codigo fuente original
    sourcemap: false,
  },
});
