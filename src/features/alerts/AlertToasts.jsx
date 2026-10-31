// Avisos emergentes de las alertas que van llegando.
import { Link } from "react-router-dom";
import { useAlerts } from "./AlertsProvider.jsx";
import { describeAlert } from "./alertCatalog.js";
import { AlertBody } from "./AlertBody.jsx";
import "./alerts.css";

export function AlertToasts() {
  const { toasts, dismissToast } = useAlerts();
  return (
    <div className="alert-toasts" aria-live="polite">
      {toasts.map((alert) => {
        const { link } = describeAlert(alert);
        return (
          <div key={alert.id} className={`alert-toast sev-${alert.severity}`} role={alert.severity === "critical" ? "alert" : "status"}>
            <AlertBody alert={alert} />
            <span className="alert-toast-actions">
              {link && <Link to={link} className="btn sm" onClick={() => dismissToast(alert.id)}>Ver</Link>}
              <button type="button" className="btn ghost sm" onClick={() => dismissToast(alert.id)} aria-label="Cerrar alerta">✕</button>
            </span>
          </div>
        );
      })}
    </div>
  );
}
