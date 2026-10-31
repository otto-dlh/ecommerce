import { useCallback, useEffect, useRef, useState } from "react";
import { auditApi } from "../../../shared/api/index.js";
import { date, ROLE_LABEL } from "../../../shared/lib/format.js";
import { useLiveRefresh, useRealtimeClient } from "../../../shared/realtime/RealtimeProvider.jsx";
import { eventLabel, isIncident, AUDIT_COUNTERS } from "../auditLabels.js";
import { ErrorAlert, Loading } from "../ui.jsx";
import "./audit.css";

// Respaldo si el realtime no esta configurado: sondeo lento en vez de eventos
const FALLBACK_POLL_MS = 15000;
const FRESH_MS = 4000;

/**
 * Bitacora en vivo: cada registro nuevo llega como evento realtime ("audit.recorded") y dispara
 * una recarga; los registros que no estaban en la carga anterior se resaltan unos segundos.
 */
function useAuditFeed(live) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState("");
  const [fresh, setFresh] = useState(() => new Set());
  const [updatedAt, setUpdatedAt] = useState(null);
  const seen = useRef(null);

  const load = useCallback(async () => {
    try {
      const d = await auditApi.entries({ limit: 150 });
      const ids = d.entries.map((e) => e.id);
      if (seen.current) {
        const added = ids.filter((id) => !seen.current.has(id));
        if (added.length) {
          setFresh(new Set(added));
          setTimeout(() => setFresh(new Set()), FRESH_MS);
        }
      }
      seen.current = new Set(ids);
      setEntries(d.entries);
      setUpdatedAt(new Date());
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const realtime = useRealtimeClient();
  useLiveRefresh("audit.recorded", load, { filter: () => live, debounceMs: 400 });
  useEffect(() => {
    if (!live || realtime.enabled) return undefined;
    const timer = setInterval(() => document.visibilityState === "visible" && load(), FALLBACK_POLL_MS);
    return () => clearInterval(timer);
  }, [live, load, realtime.enabled]);

  return { entries, error, fresh, updatedAt, load, realtimeEnabled: realtime.enabled };
}

function AuditRow({ entry, isFresh }) {
  return (
    <tr className={`${isIncident(entry) ? "incident" : ""} ${isFresh ? "fresh" : ""}`}>
      <td title={date(entry.at)}><small>{new Date(entry.at).toLocaleTimeString("es-GT")}</small></td>
      <td>
        <span className={`sev ${isIncident(entry) ? "bad" : "good"}`} />
        <b>{eventLabel(entry)}</b>
        <div><code>{entry.action}</code></div>
      </td>
      <td>{entry.actor ? <>{entry.actor.email}<br /><small className="muted">{ROLE_LABEL[entry.actor.role] ?? entry.actor.role}</small></> : <span className="muted">anónimo</span>}</td>
      <td><small>{entry.ip}</small></td>
      <td><small>{entry.target}{entry.details ? ` ${JSON.stringify(entry.details)}` : ""}</small></td>
      <td title={entry.integrity ? "Registro íntegro" : "La firma no coincide"}>{entry.integrity ? "✓" : "✗"}</td>
    </tr>
  );
}

export default function Audit() {
  const [live, setLive] = useState(true);
  const [onlyIncidents, setOnlyIncidents] = useState(false);
  const [q, setQ] = useState("");
  const { entries, error, fresh, updatedAt, load, realtimeEnabled } = useAuditFeed(live);

  if (!entries) return error ? <ErrorAlert error={error} /> : <Loading headers={["Hora","Evento","Quién","IP","Detalle","Firma"]} rows={10} label="Cargando bitácora…" />;

  const term = q.trim().toLowerCase();
  const shown = entries.filter((e) => (!onlyIncidents || isIncident(e)) && (!term || `${eventLabel(e)} ${JSON.stringify(e)}`.toLowerCase().includes(term)));
  const tampered = entries.filter((e) => !e.integrity).length;

  return (
    <>
      <div className="audit-head">
        <div className={`live-indicator ${live ? "on" : ""}`}>
          <span className="live-dot" />
          {live ? (realtimeEnabled ? "En vivo" : "Actualización periódica") : "En pausa"}
          {updatedAt && <small className="muted"> · actualizado {updatedAt.toLocaleTimeString("es-GT")}</small>}
        </div>
        <div className="row">
          <button className="btn ghost sm" onClick={() => setLive(!live)}>{live ? "⏸ Pausar" : "▶ Reanudar"}</button>
          <button className="btn ghost sm" onClick={load}>↻ Actualizar</button>
        </div>
      </div>

      <div className="stats audit-stats">
        {AUDIT_COUNTERS.map(([label, matches]) => {
          const n = entries.filter(matches).length;
          return <div key={label} className={`stat ${n && label !== "Incidentes" ? "alarm" : ""}`}><span>{label}</span><b>{n}</b></div>;
        })}
      </div>

      <div className="row between audit-filters">
        <input type="search" placeholder="Buscar (evento, usuario, detalle)…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="check-inline">
          <input type="checkbox" checked={onlyIncidents} onChange={(e) => setOnlyIncidents(e.target.checked)} /> Solo incidentes
        </label>
      </div>

      <p className={tampered ? "alert error" : "alert ok"}>
        {tampered ? `⚠ ${tampered} registros no superan la verificación HMAC: podrían haber sido alterados` : `✓ Firma HMAC verificada en los ${entries.length} registros más recientes`}
      </p>

      <div className="panel scroll">
        <table className="table small audit-table">
          <thead><tr><th>Hora</th><th>Evento</th><th>Quién</th><th>IP</th><th>Detalle</th><th>Firma</th></tr></thead>
          <tbody>
            {shown.map((e) => <AuditRow key={e.id} entry={e} isFresh={fresh.has(e.id)} />)}
            {shown.length === 0 && <tr><td colSpan="6" className="muted">Sin eventos para este filtro.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
