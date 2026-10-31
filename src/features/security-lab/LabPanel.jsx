import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { LabSteps } from "./LabSteps.jsx";
import "./security.css";

/** Tabla del laboratorio: cada prueba con su resultado, su boton para ejecutarla y sus pasos desplegables. */
export function LabPanel({ attacks, user, results, running, onRun, onRunAll }) {
  const [open, setOpen] = useState(() => new Set());

  const toggle = (i) =>
    setOpen((o) => {
      const n = new Set(o);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  const allOpen = open.size === attacks.length;
  const toggleAll = () => setOpen(allOpen ? new Set() : new Set(attacks.map((_, i) => i)));

  return (
    <section className="panel" id="laboratorio">
      <div className="row between">
        <h2>Laboratorio de pruebas</h2>
        <div className="row">
          <button className="btn ghost" onClick={toggleAll}>{allOpen ? "Ocultar pasos" : "Ver todos los pasos"}</button>
          <button className="btn" onClick={onRunAll} disabled={running}>{running ? "Ejecutando…" : "Ejecutar todas"}</button>
        </div>
      </div>
      <p className="muted">
        Cada prueba lanza un ataque real contra la API desplegada y verifica que sea bloqueado.
        Abre «Ver pasos» en cualquier prueba para seguir, en orden, lo que hace el atacante y cómo responde la tienda en cada momento.
        {user ? ` Sesión actual: ${user.email}.` : <> Algunas pruebas requieren <Link to="/login?next=/seguridad">iniciar sesión</Link> con una cuenta de cliente (puedes <Link to="/registro">crear una</Link>).</>}
      </p>
      <p className="hint">Cada intento bloqueado queda registrado. Con la cuenta de administrador puedes verlos aparecer en tiempo real en <Link to="/admin/auditoria">Administración → Auditoría</Link>.</p>
      <div className="scroll-x lab-scroll"><table className="table">
        <thead><tr><th>Amenaza</th><th>Prueba</th><th>HTTP</th><th>Resultado</th><th></th></tr></thead>
        <tbody>
          {attacks.map((t, i) => {
            const r = results[i];
            const isOpen = open.has(i);
            return (
              <Fragment key={i}>
                <tr className={`lab-row ${isOpen ? "open" : ""}`}>
                  <td><span className="tag">{t.id}</span></td>
                  <td>
                    {t.name}
                    {r?.detail && <div className="muted small">{r.detail}</div>}
                    <button className="lab-toggle" onClick={() => toggle(i)} aria-expanded={isOpen} aria-controls={`lab-steps-${i}`}>
                      {isOpen ? "Ocultar pasos ▲" : "Ver pasos ▼"}
                    </button>
                  </td>
                  <td>{r?.status !== undefined && <code>{r.status}</code>}</td>
                  <td>{r?.running ? "…" : r ? (r.skipped ? <span className="status muted">Omitida</span> : r.pass ? <span className="result-pass">🛡️ Bloqueado</span> : <span className="result-fail">Revisar</span>) : ""}</td>
                  <td><button className="btn ghost sm" onClick={() => onRun(i)} disabled={running || r?.running}>Probar</button></td>
                </tr>
                {isOpen && (
                  <tr className="lab-detail">
                    <td colSpan={5}><LabSteps test={t} id={`lab-steps-${i}`} /></td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table></div>
    </section>
  );
}
