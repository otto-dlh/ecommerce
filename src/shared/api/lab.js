// Acceso a la API del laboratorio de seguridad: reportar cada prueba ejecutada a la bitacora.
import { ENDPOINTS } from "./endpoints.js";
import { request } from "./httpClient.js";

/** Resultado de una prueba, tal como lo nombra la bitacora. */
export const labResult = (r) => (r?.skipped ? "omitida" : r?.pass ? "bloqueado" : "no_bloqueado");

export const labApi = {
  /**
   * Deja constancia de una prueba en la auditoría. Es informativo: si falla (sin red, límite de
   * peticiones), el laboratorio sigue funcionando y solo se pierde esta anotación.
   * @param {{ key: string }} test  prueba ejecutada
   * @param {{ pass?: boolean, skipped?: boolean, status?: unknown }} result
   */
  async report(test, result) {
    try {
      await request(ENDPOINTS.lab.run.url(), {
        method: "POST",
        body: { test: test.key, result: labResult(result), status: result?.status },
      });
    } catch {
      // La anotación nunca debe tumbar la prueba
    }
  },
};
