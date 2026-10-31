import { useEffect, useReducer, useState } from "react";
import { Link } from "react-router-dom";
import { ordersApi } from "../../shared/api/index.js";
import { date, money } from "../../shared/lib/format.js";
import { useLiveRefresh } from "../../shared/realtime/RealtimeProvider.jsx";
import { TableSkeleton } from "../../shared/ui/Skeleton.jsx";
import { StatusBadge } from "./StatusBadge.jsx";

const HEADERS = ["Pedido", "Fecha", "Productos", "Total", "Estado"];

export function OrdersPage() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  const [version, bump] = useReducer((n) => n + 1, 0);
  useLiveRefresh("order.updated", bump);
  useEffect(() => {
    ordersApi.listMine().then((d) => setOrders(d.orders)).catch((e) => setError(e.message));
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
