import { useRealtimeClient } from "../../shared/realtime/RealtimeProvider.jsx";
import { useAuth } from "../auth/index.js";
import { ATTACKS } from "./attacks/index.js";
import { useAttackRunner } from "./useAttackRunner.js";
import { SecurityHero } from "./SecurityHero.jsx";
import { LabPanel } from "./LabPanel.jsx";
import { TrustDiagram } from "./TrustDiagram.jsx";
import { ControlsMatrix } from "./ControlsMatrix.jsx";
import "./security.css";

/** Laboratorio de seguridad: ataques reales contra la API, arquitectura y matriz de controles. */
export function SecurityPage() {
  const { user } = useAuth();
  const realtime = useRealtimeClient();
  const { results, running, runOne, runAll, done, passed } = useAttackRunner(ATTACKS, { user, realtime });

  return (
    <>
      <SecurityHero done={done} passed={passed} />

      <LabPanel attacks={ATTACKS} user={user} results={results} running={running} onRun={runOne} onRunAll={runAll} />

      <section className="panel" id="arquitectura">
        <h2>Arquitectura y fronteras de confianza</h2>
        <p className="muted">Toca una frontera (F1–F5) para ver qué datos la cruzan y qué controles la protegen.</p>
        <TrustDiagram />
      </section>

      <section className="panel" id="controles">
        <h2>Matriz de controles</h2>
        <p className="muted">Las 14 amenazas del modelo STRIDE explicadas en lenguaje sencillo: qué podría pasar, cómo lo evitamos y dónde comprobarlo.</p>
        <ControlsMatrix />
      </section>
    </>
  );
}
