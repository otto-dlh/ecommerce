import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { date, money, STATUS } from "../format.js";

export const StatusBadge = ({ status }) => <span className={`status ${STATUS[status]?.tone}`}>{STATUS[status]?.label ?? status}</span>;

export default function Orders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/api/orders").then((d) => setOrders(d.orders)).catch((e) => setError(e.message));
  }, []);
  if (error) return <p className="alert error">{error}</p>;
  if (!orders) return <p className="muted center">Cargando…</p>;
  return (
    <>
      <h1>Mis pedidos</h1>
      {orders.length === 0 ? (
        <div className="empty"><p>Aún no tienes pedidos.</p><Link className="btn" to="/">Ir al catálogo</Link></div>
      ) : (
        <div className="panel">
          <table className="table">
            <thead><tr><th>Pedido</th><th>Fecha</th><th>Productos</th><th>Total</th><th>Estado</th></tr></thead>
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
