import { money } from "../../shared/lib/format.js";

/** Resumen de importes de una cotizacion: subtotal, descuento, envio y total. */
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
