import { useState } from "react";
import { Link } from "react-router-dom";
import { date, money } from "../../../shared/lib/format.js";
import { customersApi } from "../../../shared/api/index.js";
import { useApi } from "../../../shared/hooks/useApi.js";
import { StatusBadge } from "../../orders/index.js";
import { useLiveRefresh } from "../../../shared/realtime/RealtimeProvider.jsx";
import { ErrorAlert, Loading, ReadOnlyNote } from "../ui.jsx";

function CustomerDetail({ id, onClose }) {
  const { data, error } = useApi(() => customersApi.get(id), [id]);
  if (!data) return error ? <ErrorAlert error={error} /> : <Loading label="Cargando cliente…" />;
  const { customer, orders, addresses } = data;
  return (
    <div className="panel">
      <div className="row between"><h3>{customer.name}</h3><button className="btn ghost sm" onClick={onClose}>Cerrar</button></div>
      <p className="muted">{customer.email} · cliente desde {date(customer.createdAt)}</p>
      <h4>Pedidos</h4>
      {orders.length === 0 ? <p className="muted">Sin pedidos.</p> : (
        <ul className="plain">{orders.map((o) => <li key={o.id}><Link to={`/pedidos/${o.id}`}>#{o.id.slice(0, 8)}</Link> · {date(o.createdAt)} · {money(o.total)} <StatusBadge status={o.status} /></li>)}</ul>
      )}
      <h4>Direcciones guardadas</h4>
      {addresses.length === 0 ? <p className="muted">Sin direcciones.</p> : (
        <ul className="plain">{addresses.map((a) => <li key={a.id}>{a.name} · {a.line1}, {a.city} · {a.phone}</li>)}</ul>
      )}
      <p className="hint">Esta consulta de datos personales quedó registrada en la bitácora.</p>
    </div>
  );
}

/** Clientes (solo lectura): resumen de compras y detalle bajo demanda. */
export default function Customers() {
  const { data, error, load } = useApi(customersApi.list);
  useLiveRefresh(["admin.orders", "admin.users"], load);
  const [selected, setSelected] = useState(null);

  if (!data) return error ? <ErrorAlert error={error} /> : <Loading headers={["Cliente","Pedidos","Total pagado","Último pedido","Último acceso",""]} label="Cargando clientes…" />;
  return (
    <>
      <ReadOnlyNote>Vista de solo lectura. Abrir el detalle de un cliente queda registrado en la auditoría.</ReadOnlyNote>
      {selected && <CustomerDetail id={selected} onClose={() => setSelected(null)} />}
      <div className="panel scroll">
        <table className="table">
          <thead><tr><th>Cliente</th><th>Pedidos</th><th>Total pagado</th><th>Último pedido</th><th>Último acceso</th><th></th></tr></thead>
          <tbody>
            {data.customers.map((c) => (
              <tr key={c.id} className={c.active ? "" : "inactive"}>
                <td>{c.name}<br /><small className="muted">{c.email}</small></td>
                <td>{c.orders}</td>
                <td>{money(c.totalSpent)}</td>
                <td><small>{c.lastOrderAt ? date(c.lastOrderAt) : "—"}</small></td>
                <td><small>{c.lastLoginAt ? date(c.lastLoginAt) : "—"}</small></td>
                <td><button className="btn ghost sm" onClick={() => setSelected(c.id)}>Ver detalle</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
