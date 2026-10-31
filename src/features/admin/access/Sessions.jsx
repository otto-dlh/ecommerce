import { accessApi } from "../../../shared/api/index.js";
import { date } from "../../../shared/lib/format.js";
import { useApi, useAction } from "../../../shared/hooks/useApi.js";
import { useLiveRefresh } from "../../../shared/realtime/RealtimeProvider.jsx";
import { ACCESS_EVENTS, isAccessRelated } from "./liveEvents.js";
import { ErrorAlert, Loading } from "../ui.jsx";

/** Sesiones abiertas en este momento, con cierre remoto. */
export default function Sessions({ canManage }) {
  const { data, error, load, setError } = useApi(accessApi.sessions);
  const run = useAction(load, setError);
  useLiveRefresh(ACCESS_EVENTS, load, { filter: isAccessRelated, debounceMs: 600 });
  const close = (session) => {
    if (!confirm(`¿Cerrar la sesión de ${session.user?.email ?? "este usuario"} en ${session.device}?`)) return;
    run(() => accessApi.revokeSession(session.id));
  };

  if (!data) return error ? <ErrorAlert error={error} /> : <Loading headers={["Usuario","Dispositivo","IP","Inicio","Última actividad"]} label="Cargando sesiones…" />;
  return (
    <>
      <ErrorAlert error={error} />
      <p className="hint">Al cerrar una sesión, la persona pierde el acceso de inmediato. Se expira sola tras el tiempo de inactividad de la política.</p>
      <div className="panel scroll">
        <table className="table">
          <thead><tr><th>Usuario</th><th>Dispositivo</th><th>IP</th><th>Inicio</th><th>Última actividad</th>{canManage && <th></th>}</tr></thead>
          <tbody>
            {data.sessions.map((s) => (
              <tr key={s.id}>
                <td>{s.user?.name ?? "—"} {s.current && <span className="tag">tú</span>}<br /><small className="muted">{s.user?.email} · {s.user?.roleLabel}</small></td>
                <td>{s.device}</td>
                <td><small>{s.ip}</small></td>
                <td><small>{date(s.createdAt)}</small></td>
                <td><small>{date(s.lastSeen)}</small></td>
                {canManage && <td>{!s.current && <button className="btn ghost sm" onClick={() => close(s)}>Cerrar sesión</button>}</td>}
              </tr>
            ))}
            {data.sessions.length === 0 && <tr><td colSpan="6" className="muted">No hay sesiones activas.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
