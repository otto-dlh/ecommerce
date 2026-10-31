import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { productionCsp } from "./tooling/vite/csp.mjs";
import { localNetlifyFunctions } from "./tooling/vite/localFunctions.mjs";

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
