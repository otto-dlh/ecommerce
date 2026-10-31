import { useState } from "react";

/**
 * Ejecuta las pruebas del laboratorio (una o todas en orden) y guarda el resultado de cada una.
 * `context` ({ user, realtime }) se entrega a cada prueba al ejecutarla.
 */
export function useAttackRunner(attacks, context) {
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(false);

  const runOne = async (i) => {
    setResults((r) => ({ ...r, [i]: { running: true } }));
    try {
      const res = await attacks[i].run(context);
      setResults((r) => ({ ...r, [i]: res }));
    } catch (e) {
      setResults((r) => ({ ...r, [i]: { pass: false, status: "error", detail: e.message } }));
    }
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
