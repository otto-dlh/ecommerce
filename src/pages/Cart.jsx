import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { money } from "../format.js";
import { useCart } from "../state.jsx";
import { ProductImage } from "../components/ProductImage.jsx";

export function Totals({ quote }) {
  return (
    <dl className="totals">
      <dt>Subtotal</dt><dd>{money(quote.subtotal)}</dd>
      {quote.discount > 0 && (<><dt>Descuento {quote.coupon ? `(${quote.coupon.code})` : ""}</dt><dd className="ok-text">−{money(quote.discount)}</dd></>)}
      <dt>Envío</dt><dd>{quote.shipping === 0 ? "Gratis" : money(quote.shipping)}</dd>
      <dt className="total">Total</dt><dd className="total">{money(quote.total)}</dd>
    </dl>
  );
}

export function useQuote(items, coupon) {
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!items.length) { setQuote(null); return; }
    api("/api/cart/quote", { method: "POST", body: { items, coupon: coupon || undefined } })
      .then((q) => { setQuote(q); setError(""); })
      .catch((e) => { setError(e.message); });
  }, [JSON.stringify(items), coupon]);
  return { quote, error };
}

export default function Cart() {
  const cart = useCart();
  const navigate = useNavigate();
  const [couponInput, setCouponInput] = useState(() => sessionStorage.getItem("coupon") || "");
  const [coupon, setCoupon] = useState(couponInput);
  const { quote, error } = useQuote(cart.items, coupon);

  if (!cart.items.length) {
    return (
      <div className="empty">
        <span className="big">🛒</span>
        <h2>Tu carrito está vacío</h2>
        <p className="muted">Descubre café de altura, artesanías y más.</p>
        <Link to="/" className="btn">Ir al catálogo</Link>
      </div>
    );
  }

  const applyCoupon = (e) => {
    e.preventDefault();
    setCoupon(couponInput.trim().toUpperCase());
  };

  const go = () => {
    sessionStorage.setItem("coupon", coupon);
    navigate("/checkout");
  };

  return (
    <>
      <div className="steps"><span className="on">1 Carrito</span><span className="">2 Envío</span><span className="">3 Pago</span><span className="">4 Confirmación</span></div>
      <h1>Tu carrito</h1>
      <div className="two-col">
        <div className="panel">
          {(quote?.lines ?? cart.items.map((i) => ({ ...i, name: i.productId }))).map((l) => (
            <div className="cart-line" key={l.productId}>
              {l.emoji ? <ProductImage product={{ ...l, color: "#e9eaf7" }} className="emoji" /> : <span className="emoji" />}
              <div className="grow">
                <Link to={`/producto/${l.productId}`}>{l.name}</Link>
                {l.unitPrice !== undefined && <div className="muted">{money(l.unitPrice)} c/u</div>}
                {l.available !== undefined && l.qty > l.available && <div className="error-text">Solo hay {l.available} disponibles</div>}
              </div>
              <input type="number" min="1" max="10" className="qty" value={l.qty} onChange={(e) => cart.setQty(l.productId, Number(e.target.value))} aria-label="Cantidad" />
              <strong className="line-total">{l.lineTotal !== undefined ? money(l.lineTotal) : "—"}</strong>
              <button className="btn ghost sm" onClick={() => cart.remove(l.productId)} aria-label="Quitar">✕</button>
            </div>
          ))}
        </div>
        <aside className="panel sticky">
          <form onSubmit={applyCoupon} className="row">
            <input placeholder="Cupón" value={couponInput} maxLength={30} onChange={(e) => setCouponInput(e.target.value)} />
            <button className="btn ghost">Aplicar</button>
          </form>
          {coupon && !error && quote?.coupon && <p className="ok-text">✓ {quote.coupon.label}</p>}
          {error && (
            <p className="alert error">
              {error} {coupon && <button className="link" onClick={() => { setCoupon(""); setCouponInput(""); }}>Quitar cupón</button>}
            </p>
          )}
          {quote && <Totals quote={quote} />}
          <p className="hint">Los importes los calcula el servidor; el navegador nunca envía precios (T02).</p>
          <button className="btn block lg" disabled={!quote || !!error} onClick={go}>Continuar con la compra →</button>
        </aside>
      </div>
    </>
  );
}
