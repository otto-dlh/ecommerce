import { useState } from "react";
import { labApi } from "../../shared/api/index.js";

/**
 * Ejecuta las pruebas del laboratorio (una o todas en orden) y guarda el resultado de cada una.
 * `context` ({ user, realtime }) se entrega a cada prueba al ejecutarla.
 *
 * Toda prueba ejecutada se reporta a la bitacora (`labApi.report`), incluso las que no tocan
 * nuestra API: asi el laboratorio completo queda en Administracion → Auditoria. El reporte es
 * informativo y no altera el resultado que se muestra.
 */
export function useAttackRunner(attacks, context) {
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(false);

  const runOne = async (i) => {
    setResults((r) => ({ ...r, [i]: { running: true } }));
    let res;
    try {
      res = await attacks[i].run(context);
    } catch (e) {
      res = { pass: false, status: "error", detail: e.message };
    }
    setResults((r) => ({ ...r, [i]: res }));
    await labApi.report(attacks[i], res);
  };
  const runAll = async () => {
    setRunning(true);
    for (let i = 0; i < attacks.length; i++) await runOne(i);
    setRunning(false);
  };

  // Resumen: pruebas terminadas (sin contar las omitidas) y cuantas bloquearon el ataque
  const done = Object.values(results).filter((r) => r && !r.running && !r.skipped);
  const passed = done.filter((r) => r.pass).length;

  return { results, running, runOne, runAll, done: done.length, passed };
}
