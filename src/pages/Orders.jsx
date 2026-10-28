import { useEffect, useReducer, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { date, money, STATUS } from "../format.js";
import { TableSkeleton } from "../components/Skeleton.jsx";
import { useLiveRefresh } from "../realtime/RealtimeProvider.jsx";

const HEADERS = ["Pedido", "Fecha", "Productos", "Total", "Estado"];

export const StatusBadge = ({ status }) => <span className={`status ${STATUS[status]?.tone}`}>{STATUS[status]?.label ?? status}</span>;

export default function Orders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  const [version, bump] = useReducer((n) => n + 1, 0);
  useLiveRefresh("order.updated", bump);
  useEffect(() => {
    api("/api/orders").then((d) => setOrders(d.orders)).catch((e) => setError(e.message));
  }, [version]);
  if (error) return <p className="alert error">{error}</p>;
  if (!orders) {
    return (
      <>
        <h1>Mis pedidos</h1>
        <TableSkeleton headers={HEADERS} rows={4} variants={["line", "line", "line", "line", "pill"]} label="Cargando pedidos…" />
      </>
    );
  }
  return (
    <>
      <h1>Mis pedidos</h1>
      {orders.length === 0 ? (
        <div className="empty"><p>Aún no tienes pedidos.</p><Link className="btn" to="/">Ir al catálogo</Link></div>
      ) : (
        <div className="panel scroll">
          <table className="table">
            <thead><tr>{HEADERS.map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td><Link to={`/pedidos/${o.id}`}>#{o.id.slice(0, 8)}</Link></td>
                  <td>{date(o.createdAt)}</td>
                  <td>{o.items.reduce((s, i) => s + i.qty, 0)}</td>
                  <td>{money(o.total)}</td>
                  <td><StatusBadge status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
