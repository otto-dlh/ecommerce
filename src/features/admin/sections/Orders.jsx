import { useState } from "react";
import { Link } from "react-router-dom";
import { salesAdminApi } from "../../../shared/api/index.js";
import { date, money, STATUS } from "../../../shared/lib/format.js";
import { can } from "../../../shared/lib/permissions.js";
import { useAuth } from "../../auth/index.js";
import { useApi, useAction } from "../../../shared/hooks/useApi.js";
import { StatusBadge } from "../../orders/index.js";
import { useLiveRefresh } from "../../../shared/realtime/RealtimeProvider.jsx";
import { ErrorAlert, Loading, ReadOnlyNote } from "../ui.jsx";

const NEXT_LABEL = { preparando: "Preparar", enviado: "Marcar enviado", entregado: "Marcar entregado", cancelado: "Cancelar" };

/** Transiciones que este usuario puede aplicar desde el panel. */
function allowedActions(user, order, transitions) {
  if (!can(user, "orders:manage")) return [];
  return (transitions[order.status] || []).filter((to) => to !== "cancelado" || (can(user, "orders:cancel") && order.status !== "pendiente_pago"));
}

export default function Orders() {
  const { user } = useAuth();
  const { data, error, load, setError } = useApi(salesAdminApi.orders);
  useLiveRefresh("admin.orders", load);
  const run = useAction(load, setError);
  const [filter, setFilter] = useState("");

  const change = (id, status) => {
    if (status === "cancelado" && !confirm("¿Cancelar el pedido? Se devolverá el inventario.")) return;
    run(() => salesAdminApi.changeOrderStatus(id, status));
  };

  if (!data) return error ? <ErrorAlert error={error} /> : <Loading headers={["Pedido","Fecha","Cliente","Total","Estado","Acciones"]} rows={8} label="Cargando pedidos…" />;
  const orders = filter ? data.orders.filter((o) => o.status === filter) : data.orders;
  return (
    <>
      <ErrorAlert error={error} />
      {!can(user, "orders:manage") && <ReadOnlyNote />}
      <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrar por estado">
        <option value="">Todos los estados</option>
        {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
      </select>
      <div className="panel scroll">
        <table className="table">
          <thead><tr><th>Pedido</th><th>Fecha</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td><Link to={`/pedidos/${o.id}`}>#{o.id.slice(0, 8)}</Link></td>
                <td>{date(o.createdAt)}</td>
                <td>{o.address.name}</td>
                <td>{money(o.total)}</td>
                <td><StatusBadge status={o.status} /></td>
                <td className="row nowrap">
                  {allowedActions(user, o, data.transitions).map((s) => (
                    <button key={s} className={`btn sm ${s === "cancelado" ? "ghost" : ""}`} onClick={() => change(o.id, s)}>{NEXT_LABEL[s]}</button>
                  ))}
                  {o.status === "pendiente_pago" && <small className="muted">Esperando webhook de pago</small>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
