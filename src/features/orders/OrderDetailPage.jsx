import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ordersApi } from "../../shared/api/index.js";
import { date, money, STATUS } from "../../shared/lib/format.js";
import { useLiveRefresh } from "../../shared/realtime/RealtimeProvider.jsx";
import { useAuth } from "../auth/index.js";
import { StatusBadge } from "./StatusBadge.jsx";
import { OrderDetailSkeleton } from "./OrderDetailSkeleton.jsx";
import "./orders.css";

const HEADERS = ["Producto", "Precio", "Cant.", "Total"];

export function OrderDetailPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");

  const load = () => ordersApi.get(id).then((d) => setOrder(d.order)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]);
  useLiveRefresh("order.updated", load, { filter: (p) => p.orderId === id });

  const cancel = async () => {
    if (!confirm("¿Cancelar este pedido? Se liberará el inventario reservado.")) return;
    try {
      const d = await ordersApi.cancel(order.id);
      setOrder(d.order);
    } catch (e) {
      setError(e.message);
    }
  };

  if (error) return <><Link to="/pedidos" className="back">← Mis pedidos</Link><p className="alert error">{error}</p></>;
  if (!order) return <OrderDetailSkeleton headers={HEADERS} />;
  const mine = order.userId === user.id;

  return (
    <>
      <Link to={mine ? "/pedidos" : "/admin/pedidos"} className="back">← Volver</Link>
      {params.get("pagado") && order.status === "pagado" && <p className="alert ok">✓ Pago confirmado por la pasarela. ¡Gracias por tu compra!</p>}
      <div className="row between">
        <h1>Pedido #{order.id.slice(0, 8)}</h1>
        <StatusBadge status={order.status} />
      </div>
      <div className="two-col">
        <div className="panel scroll">
          <table className="table">
            <thead><tr>{HEADERS.map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {order.items.map((i) => (
                <tr key={i.productId}><td>{i.name}</td><td>{money(i.unitPrice)}</td><td>{i.qty}</td><td>{money(i.lineTotal)}</td></tr>
              ))}
            </tbody>
          </table>
          <dl className="totals">
            <dt>Subtotal</dt><dd>{money(order.subtotal)}</dd>
            {order.discount > 0 && (<><dt>Descuento ({order.coupon})</dt><dd className="ok-text">−{money(order.discount)}</dd></>)}
            <dt>Envío</dt><dd>{order.shipping === 0 ? "Gratis" : money(order.shipping)}</dd>
            <dt className="total">Total</dt><dd className="total">{money(order.total)}</dd>
          </dl>
          {mine && order.status === "pendiente_pago" && (
            <div className="row">
              <Link className="btn" to={`/pagar/${order.id}`}>Pagar ahora</Link>
              <button className="btn ghost" onClick={cancel}>Cancelar pedido</button>
              <span className="muted">Reserva válida hasta {date(order.expiresAt)}</span>
            </div>
          )}
        </div>
        <aside className="panel">
          <h3>Envío</h3>
          <p>{order.address.name}<br />{order.address.line1}<br />{order.address.city}<br />{order.address.phone}</p>
          {order.payment && (<><h3>Pago</h3><p>{order.payment.brand?.toUpperCase()} •••• {order.payment.last4}<br /><small className="muted">Ref. {order.payment.ref}</small></p></>)}
          <h3>Historial</h3>
          <ol className="timeline">
            {order.history.map((h, i) => (
              <li key={i}><b>{STATUS[h.status]?.label ?? h.status}</b><br /><small className="muted">{date(h.at)} · {h.by.includes(":") ? h.by : h.by === user.id ? "tú" : "personal"}</small></li>
            ))}
          </ol>
        </aside>
      </div>
    </>
  );
}
