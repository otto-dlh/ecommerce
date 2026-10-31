import "./lab-steps.css";

// Los fragmentos entre `comillas invertidas` se muestran como <code>; todo lo demas es texto plano.
const rich = (s) => s.split("`").map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));

// Quien actua en cada momento de la linea de tiempo de una prueba
const ACTORS = { atacante: "Atacante", navegador: "Navegador", servidor: "Servidor", bitacora: "Bitácora", lab: "Laboratorio" };

/** Pasos de una prueba: objetivo del atacante, linea de tiempo, resultado esperado y donde verlo. */
export function LabSteps({ test, id }) {
  return (
    <div className="lab-steps" id={id}>
      <p className="lab-goal"><span>Qué intenta el atacante</span>{rich(test.goal)}</p>
      <ol className="lab-timeline">
        {test.steps.map(([who, text], i) => (
          <li key={i} className={`tl-${who}`}>
            <span className="tl-actor">{ACTORS[who]}</span>
            <p>{rich(text)}</p>
          </li>
        ))}
        <li className="tl-result">
          <span className="tl-actor">Resultado esperado</span>
          <p>{rich(test.expect)}</p>
        </li>
      </ol>
      <dl>
        {test.evidence && <><dt>Dónde verlo</dt><dd>{test.evidence}</dd></>}
        <dt>Código</dt><dd><code>{test.code}</code></dd>
      </dl>
    </div>
  );
}
