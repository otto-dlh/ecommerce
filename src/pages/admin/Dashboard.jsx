import { money, STATUS } from "../../format.js";
import { useApi } from "../../hooks/useApi.js";
import { useLiveRefresh } from "../../realtime/RealtimeProvider.jsx";
import { ErrorAlert, Loading } from "./ui.jsx";

const SECURITY_ALERTS = [
  ["loginFailures24h", "Logins fallidos", (n) => n >= 10],
  ["authzDenied24h", "Autorizaciones denegadas", (n) => n > 0],
  ["rateLimited24h", "Bloqueos por rate limit", (n) => n > 0],
  ["webhookRejected24h", "Webhooks rechazados", (n) => n > 0],
  ["csrfRejected24h", "CSRF bloqueados", (n) => n > 0],
];

export default function Dashboard() {
  const { data, error, load } = useApi("/api/admin/stats");
  useLiveRefresh(["admin.orders", "admin.inventory", "audit.recorded"], load, { debounceMs: 800 });
  if (error) return <ErrorAlert error={error} />;
  if (!data) return <Loading stats={6} label="Cargando resumen…" />;
  return (
    <>
      <div className="stats">
        <div className="stat"><span>Ventas confirmadas</span><b>{money(data.revenue)}</b></div>
        <div className="stat"><span>Pedidos</span><b>{data.orders}</b></div>
        {Object.entries(data.byStatus).map(([k, n]) => <div className="stat" key={k}><span>{STATUS[k]?.label ?? k}</span><b>{n}</b></div>)}
      </div>
      <h3>Alertas de seguridad (últimas 24 h)</h3>
      <div className="stats">
        {SECURITY_ALERTS.map(([key, label, isAlarm]) => (
          <div key={key} className={`stat ${isAlarm(data.security[key]) ? "alarm" : ""}`}><span>{label}</span><b>{data.security[key]}</b></div>
        ))}
      </div>
      <h3>Inventario bajo</h3>
      {data.lowStock.length === 0 ? <p className="muted">Sin alertas.</p> : (
        <ul className="plain">{data.lowStock.map((p) => <li key={p.id}>{p.name}: <b>{p.stock}</b></li>)}</ul>
      )}
    </>
  );
}
