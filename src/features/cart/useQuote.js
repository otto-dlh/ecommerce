import { useEffect, useReducer, useState } from "react";
import { cartApi } from "../../shared/api/index.js";
import { useLiveRefresh } from "../../shared/realtime/RealtimeProvider.jsx";

/** El aviso afecta al carrito si no trae productos (p. ej. cupones) o si toca alguno de los que lleva. */
const touchesCart = (items) => (payload) => !payload.productIds || payload.productIds.some((id) => items.some((i) => i.productId === id));

/** Cotizacion del carrito calculada por el servidor (precios, descuento, envio y total). */
export function useQuote(items, coupon) {
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState("");
  // Si cambia el precio o el stock de algo del carrito, el servidor vuelve a cotizar
  const [version, bump] = useReducer((n) => n + 1, 0);
  useLiveRefresh(["catalog.products", "catalog.stock", "catalog.coupons"], bump, { filter: touchesCart(items) });
  useEffect(() => {
    if (!items.length) { setQuote(null); return; }
    cartApi.quote(items, coupon)
      .then((q) => { setQuote(q); setError(""); })
      .catch((e) => { setError(e.message); });
  }, [JSON.stringify(items), coupon, version]);
  return { quote, error };
}
