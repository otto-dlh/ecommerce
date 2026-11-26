// Reporte del laboratorio de seguridad: deja en la bitacora constancia de CADA prueba ejecutada.
//
// Por que existe: varias pruebas no pasan por nuestra API (van directo a InsForge, o se resuelven
// dentro del navegador), asi que ningun control del servidor puede registrarlas. Sin este reporte,
// esas pruebas no dejarian rastro y la auditoria solo mostraria una parte del laboratorio.
//
// Lo que llega del navegador es dato, no verdad: solo se acepta una clave de la lista blanca
// (LAB_TESTS) y un resultado del enumerado; el nombre y la amenaza los pone el servidor.
// Por eso estos registros usan su propia accion (`lab.attack`), separada de los eventos que si
// levantan los controles reales (authz.denied, csrf.token_rejected, ...): en la bitacora se distinguen.
import { ValidationError } from "../../../shared/domain/errors.mjs";
import { BUCKETS } from "../../../shared/security/rateLimiter.mjs";
import { LAB_TESTS, LAB_RESULTS, LAB_ACTION, cleanStatus } from "../domain/labTests.mjs";

const REPORTS_PER_IP = 120;
const WINDOW_SEC = 600;

export function createLabService({ audit, rateLimiter }) {
  /**
   * Registra la ejecucion de una prueba del laboratorio.
   * @param {object} ctx
   * @param {{ test?: string, result?: string, status?: unknown }} body
   */
  async function reportRun(ctx, body) {
    await rateLimiter.hit(ctx, BUCKETS.LAB, ctx.ip, REPORTS_PER_IP, WINDOW_SEC);

    const test = LAB_TESTS[body?.test];
    if (!test) throw new ValidationError("Prueba de laboratorio desconocida");
    const outcome = LAB_RESULTS[body?.result];
    if (!outcome) throw new ValidationError("Resultado de laboratorio inválido");

    await audit.record(ctx, LAB_ACTION, {
      outcome,
      target: `lab:${body.test}`,
      details: {
        prueba: test.name,
        amenaza: test.threat,
        resultado: body.result,
        estado: cleanStatus(body?.status),
        // De donde sale la evidencia: "api" ademas tiene el registro propio del control
        origen: test.surface,
      },
    });
    return { recorded: true };
  }

  return { reportRun };
}
