// Campana con contador: historial de alertas de la sesion.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAlerts } from "./AlertsProvider.jsx";
import { describeAlert } from "./alertCatalog.js";
import { AlertBody } from "./AlertBody.jsx";
import { useUnreadTitle } from "./useUnreadTitle.js";
import "./alerts.css";

function timeAgo(iso) {
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 60) return "hace un momento";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  return new Date(iso).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" });
}

export function AlertBell() {
  const { alerts, unread, markAllRead, clear } = useAlerts();
  const [open, setOpen] = useState(false);
  const [fresh, setFresh] = useState(() => new Set());
  const root = useRef(null);
  useUnreadTitle(unread);

  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => { if (!root.current?.contains(e.target)) setOpen(false); };
    const escape = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const toggle = () => {
    if (!open) {
      // Se resaltan las que estaban sin leer al abrir, y quedan leidas
      setFresh(new Set(alerts.filter((a) => !a.read).map((a) => a.id)));
      markAllRead();
    }
    setOpen(!open);
  };

  return (
    <div className="alert-bell" ref={root}>
      <button type="button" className="bell-btn" onClick={toggle} aria-expanded={open} aria-haspopup="dialog" aria-label={unread ? `Alertas: ${unread} sin leer` : "Alertas"}>
        🔔{unread > 0 && <span className="badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="alert-panel" role="dialog" aria-label="Alertas">
          <div className="alert-panel-head">
            <b>Alertas</b>
            {alerts.length > 0 && <button type="button" className="btn ghost sm" onClick={clear}>Limpiar</button>}
          </div>
          {alerts.length === 0 ? (
            <p className="muted small alert-empty">Sin alertas por ahora. Las que correspondan a tu rol aparecerán aquí en tiempo real.</p>
          ) : (
            <ul className="alert-list">
              {alerts.map((alert) => {
                const { link } = describeAlert(alert);
                const content = (
                  <>
                    <AlertBody alert={alert} />
                    <time className="alert-time" dateTime={alert.at}>{timeAgo(alert.at)}</time>
                  </>
                );
                return (
                  <li key={alert.id} className={`alert-item sev-${alert.severity} ${fresh.has(alert.id) ? "fresh" : ""}`}>
                    {link ? <Link to={link} onClick={() => setOpen(false)}>{content}</Link> : <div>{content}</div>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
