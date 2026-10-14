import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, request } from "../api.js";
import { money } from "../format.js";

export default function Pay() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [card, setCard] = useState({ number: "4242 4242 4242 4242", exp: "12/30", cvc: "123", holder: "" });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api(`/api/orders/${encodeURIComponent(id)}`).then((d) => setOrder(d.order)).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="alert error">{error}</p>;
  if (!order) return <p className="muted center">Cargando…</p>;
  if (order.status !== "pendiente_pago") {
    return (
      <div className="empty">
        <p>Este pedido ya no está pendiente de pago (estado: {order.status}).</p>
        <Link className="btn" to={`/pedidos/${order.id}`}>Ver pedido</Link>
      </div>
    );
  }

  const pay = async (e) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    // Los datos de tarjeta van directo al proveedor sandbox (/sandbox/pay), nunca a la API de la tienda (/api)
    const r = await request("/sandbox/pay", { method: "POST", csrf: false, body: { orderId: order.id, amount: order.total, card } });
    setBusy(false);
    if (r.ok && r.data.status === "approved") {
      navigate(`/pedidos/${order.id}?pagado=1`);
    } else {
      setResult(r.data.message || r.data.error || "No se pudo procesar el pago");
    }
  };

  const set = (k) => (e) => setCard({ ...card, [k]: e.target.value });
  const digits = card.number.replace(/\D/g, "");
  // Vista previa enmascarada: solo se muestran los ultimos 4 digitos
  const masked = (digits.slice(0, -4).replace(/\d/g, "•") + digits.slice(-4)).padEnd(16, "•").replace(/(.{4})/g, "$1 ").trim();

  return (
    <div className="sandbox">
      <div className="sandbox-head">
        <b>🔒 PagoSandbox</b>
        <small>MODO PRUEBA</small>
      </div>
      <div className="credit-card" aria-hidden="true">
        <div className="row between"><span className="chip-ic" /><span className="brand-tag">{digits.startsWith("4") ? "VISA" : digits.startsWith("5") ? "Mastercard" : "CARD"}</span></div>
        <div className="number">{masked}</div>
        <div className="meta"><span>{card.holder || "NOMBRE DEL TITULAR"}</span><span>{card.exp || "MM/AA"}</span></div>
      </div>
      <div className="pay-amount">
        <span className="muted">Pagar a <b>Tienda Segura</b></span>
        <span className="price">{money(order.total)}</span>
      </div>
      <form onSubmit={pay} className="form">
        <label>Número de tarjeta<input value={card.number} onChange={set("number")} inputMode="numeric" autoComplete="cc-number" maxLength={23} required /></label>
        <div className="row">
          <label className="grow">Vence (MM/AA)<input value={card.exp} onChange={set("exp")} autoComplete="cc-exp" maxLength={5} required /></label>
          <label className="grow">CVV<input value={card.cvc} onChange={set("cvc")} inputMode="numeric" autoComplete="cc-csc" maxLength={4} required /></label>
        </div>
        <label>Titular<input value={card.holder} onChange={set("holder")} autoComplete="cc-name" maxLength={60} /></label>
        {result && <p className="alert error">{result}</p>}
        <button className="btn block" disabled={busy}>{busy ? "Procesando…" : `Pagar ${money(order.total)}`}</button>
      </form>
      <div className="hint">
        <p><b>Tarjetas de prueba:</b> 4242 4242 4242 4242 (aprobada) · 4000 0000 0000 0002 (rechazada).</p>
        <p>La tienda nunca recibe ni guarda el número completo ni el CVV: solo la referencia y los últimos 4 dígitos, que llegan en un webhook firmado con HMAC (T09).</p>
      </div>
      <Link to={`/pedidos/${order.id}`} className="back">Cancelar y volver al pedido</Link>
    </div>
  );
}
