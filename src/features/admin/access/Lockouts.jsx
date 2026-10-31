import { accessApi } from "../../../shared/api/index.js";
import { date } from "../../../shared/lib/format.js";
import { useApi, useAction } from "../../../shared/hooks/useApi.js";
import { useLiveRefresh } from "../../../shared/realtime/RealtimeProvider.jsx";
import { ACCESS_EVENTS, isAccessRelated } from "./liveEvents.js";
import { ErrorAlert, Loading } from "../ui.jsx";

function LockoutTable({ lockouts, canManage, onUnlock }) {
  return (
    <div className="panel scroll">
      <table className="table">
        <thead><tr><th>Cuenta</th><th>Alcance</th><th>Fallos</th><th>Estado</th><th>Se libera</th>{canManage && <th></th>}</tr></thead>
        <tbody>
          {lockouts.map((l) => (
            <tr key={`${l.bucket}/${l.key}`} className={l.locked ? "warn-row" : ""}>
              <td>{l.label ?? "—"}</td>
              <td><small>{l.scope}</small></td>
              <td><b>{l.failures}</b> / {l.threshold}</td>
              <td>{l.locked ? <span className="status warn">Bloqueada</span> : <span className="status muted">En observación</span>}</td>
              <td><small>{date(l.resetAt)}</small></td>
              {canManage && <td><button className="btn ghost sm" onClick={() => onUnlock(l)}>{l.locked ? "Desbloquear" : "Reiniciar"}</button></td>}
            </tr>
          ))}
          {lockouts.length === 0 && <tr><td colSpan="6" className="muted">No hay cuentas con intentos fallidos recientes.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function AttemptList({ attempts }) {
  if (attempts.length === 0) return <p className="muted">Sin intentos fallidos en las últimas 24 h.</p>;
  return (
    <div className="panel scroll">
      <table className="table small">
        <thead><tr><th>Hora</th><th>Cuenta</th><th>Factor</th><th>IP</th></tr></thead>
        <tbody>
          {attempts.map((a, i) => (
            <tr key={`${a.at}-${i}`}>
              <td><small>{date(a.at)}</small></td>
              <td>{a.account ?? "—"}</td>
              <td><small>{a.kind}</small></td>
              <td><small>{a.ip}</small></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Ventanas de intentos fallidos (bloqueos por fuerza bruta) e historial de 24 h. */
export default function Lockouts({ canManage }) {
  const lockouts = useApi(accessApi.lockouts);
  const attempts = useApi(accessApi.failedAttempts);
  const reload = () => Promise.all([lockouts.load(), attempts.load()]);
  const run = useAction(reload, lockouts.setError);
  useLiveRefresh(ACCESS_EVENTS, reload, { filter: isAccessRelated, debounceMs: 600 });
  const unlock = (l) => run(() => accessApi.unlock(l));

  if (!lockouts.data || !attempts.data) {
    const error = lockouts.error || attempts.error;
    return error ? <ErrorAlert error={error} /> : <Loading headers={["Cuenta","Alcance","Fallos","Estado","Se libera"]} label="Cargando bloqueos…" />;
  }
  return (
    <>
      <ErrorAlert error={lockouts.error} />
      <p className="hint">Las cuentas se identifican enmascaradas. Desbloquear borra el contador de fallos; la persona puede volver a intentar de inmediato.</p>
      <h3>Cuentas con intentos fallidos</h3>
      <LockoutTable lockouts={lockouts.data.lockouts} canManage={canManage} onUnlock={unlock} />
      <h3>Intentos fallidos (últimas 24 h)</h3>
      <AttemptList attempts={attempts.data.attempts} />
    </>
  );
}
