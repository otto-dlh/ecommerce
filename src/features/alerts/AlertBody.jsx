import { describeAlert, SEVERITY_ICON, SEVERITY_LABEL } from "./alertCatalog.js";
import "./alerts.css";

/** Icono, titulo y texto de una alerta (comun a la campana y a los avisos emergentes). */
export function AlertBody({ alert }) {
  const { title, body } = describeAlert(alert);
  return (
    <>
      <span className="alert-icon" aria-label={SEVERITY_LABEL[alert.severity]}>{SEVERITY_ICON[alert.severity] ?? "🔔"}</span>
      <span className="alert-text">
        <b>{title}{alert.count > 1 && <span className="alert-count"> ×{alert.count}</span>}</b>
        <span>{body}</span>
      </span>
    </>
  );
}
