import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { addressesApi, ordersApi } from "../../shared/api/index.js";
import { FieldSkeleton, LoadingRegion } from "../../shared/ui/Skeleton.jsx";
import { useAuth } from "../auth/index.js";
import { Totals, useCart, useQuote } from "../cart/index.js";
import { SummarySkeleton } from "./SummarySkeleton.jsx";
import "./checkout.css";

const EMPTY = { name: "", line1: "", city: "Guatemala", phone: "" };

export function CheckoutPage() {
  const cart = useCart();
  const { user } = useAuth();
  const coupon = sessionStorage.getItem("coupon") || "";
  const { quote, error: quoteError } = useQuote(cart.items, coupon);
  const [addresses, setAddresses] = useState(null); // null = cargando
  const [address, setAddress] = useState({ ...EMPTY, name: user.name });
  const [save, setSave] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState(null);

  useEffect(() => {
    addressesApi.list().then((d) => setAddresses(d.addresses)).catch(() => setAddresses([]));
  }, []);

  // Va antes de la guarda del carrito vacío: al confirmar, el carrito se vacía en el mismo render
  // y esa guarda mandaba de vuelta a /carrito en lugar de a la pasarela.
  if (placedOrderId) return <Navigate to={`/pagar/${placedOrderId}`} replace />;
  if (!cart.items.length) return <Navigate to="/carrito" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (save) await addressesApi.create(address);
      const { order } = await ordersApi.place({ items: cart.items, coupon, address });
      sessionStorage.removeItem("coupon");
      setPlacedOrderId(order.id);
      cart.clear();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const field = (k, label, props = {}) => (
    <label>
      {label}
      <input value={address[k]} onChange={(e) => setAddress({ ...address, [k]: e.target.value })} required {...props} />
    </label>
  );

  return (
    <>
      <div className="steps"><span className="done">✓ Carrito</span><span className="on">2 Envío</span><span className="">3 Pago</span><span className="">4 Confirmación</span></div>
      <h1>Datos de envío</h1>
      <div className="two-col">
        <form className="panel form" onSubmit={submit}>
          {addresses === null ? (
            <LoadingRegion label="Cargando direcciones guardadas…"><FieldSkeleton /></LoadingRegion>
          ) : addresses.length > 0 && (
            <label>
              Direcciones guardadas
              <select onChange={(e) => { const a = addresses.find((x) => x.id === e.target.value); if (a) setAddress({ name: a.name, line1: a.line1, city: a.city, phone: a.phone }); }} defaultValue="">
                <option value="" disabled>Selecciona…</option>
                {addresses.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.line1}</option>)}
              </select>
            </label>
          )}
          {field("name", "Nombre de quien recibe", { maxLength: 80 })}
          {field("line1", "Dirección", { maxLength: 160 })}
          {field("city", "Ciudad / municipio", { maxLength: 60 })}
          {field("phone", "Teléfono", { maxLength: 20, inputMode: "tel" })}
          <label className="check"><input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} /> Guardar esta dirección</label>
          {error && <p className="alert error">{error}</p>}
          <button className="btn block lg" disabled={busy || !quote || !!quoteError}>{busy ? "Creando pedido…" : "Confirmar pedido e ir a pagar"}</button>
          <p className="hint">Al confirmar se reserva el inventario durante 15 minutos mientras completas el pago.</p>
        </form>
        <aside className="panel sticky">
          <h3>Resumen</h3>
          {quoteError && <p className="alert error">{quoteError}</p>}
          {quote ? (
            <>
              <ul className="summary">
                {quote.lines.map((l) => <li key={l.productId}><span>{l.emoji} {l.name} × {l.qty}</span></li>)}
              </ul>
              <Totals quote={quote} />
            </>
          ) : !quoteError && <SummarySkeleton lines={cart.items.length} />}
        </aside>
      </div>
    </>
  );
}
