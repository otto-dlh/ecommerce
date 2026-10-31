import { useEffect, useReducer, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { catalogApi } from "../../shared/api/index.js";
import { money } from "../../shared/lib/format.js";
import { useLiveRefresh } from "../../shared/realtime/RealtimeProvider.jsx";
import { useCart } from "../cart/index.js";
import { ProductTile } from "./ProductTile.jsx";
import { ProductDetailSkeleton } from "./ProductDetailSkeleton.jsx";
import { ProductReviews } from "./ProductReviews.jsx";
import { Stars } from "./Stars.jsx";
import "./catalog.css";

export function ProductPage() {
  const { id } = useParams();
  const cart = useCart();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState("");

  const [credit, setCredit] = useState(null);

  const [version, bump] = useReducer((n) => n + 1, 0);
  useLiveRefresh(["catalog.products", "catalog.stock", "catalog.reviews"], bump, { filter: (p) => (p.productIds ?? [p.productId]).includes(id) });
  useEffect(() => {
    catalogApi.product(id).then(setData).catch((e) => setError(e.message));
    // Atribucion de la foto (archivo estatico generado por tooling/scripts/fetch-stock-photos.mjs)
    fetch("/products/credits.json").then((r) => (r.ok ? r.json() : {})).then((c) => setCredit(c[id] ?? null)).catch(() => {});
  }, [id, version]);

  if (error) return <p className="alert error">{error}</p>;
  if (!data) {
    return (
      <>
        <Link to="/" className="back">← Volver al catálogo</Link>
        <ProductDetailSkeleton />
      </>
    );
  }
  const { product: p, reviews } = data;
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  return (
    <>
      <Link to="/" className="back">← Volver al catálogo</Link>
      <div className="product-detail">
        <figure className="product-figure">
          <ProductTile product={p} size="lg" />
          {credit && p.image && (
            <figcaption>
              Foto: <a href={credit.url} target="_blank" rel="noopener noreferrer">{credit.photographer}</a> en {credit.source}
            </figcaption>
          )}
        </figure>
        <div className="product-info">
          <span className="tag">{p.category}</span>
          <h1>{p.name}</h1>
          {reviews.length > 0 && <p><Stars n={Math.round(avg)} /> <span className="muted">({reviews.length} reseñas)</span></p>}
          <p className="lead">{p.description}</p>
          <div className="buy-box">
            <div className="row between">
              <span className="price xl">{money(p.price)}</span>
              {p.stock === 0 ? <span className="pill out">Agotado</span> : p.stock <= 3 ? <span className="pill hot">🔥 Quedan {p.stock}</span> : <span className="status ok">{p.stock} disponibles</span>}
            </div>
            <div className="row nowrap">
              <input type="number" min="1" max={Math.min(10, p.stock)} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="qty" aria-label="Cantidad" />
              <button className="btn lg grow" disabled={p.stock === 0} onClick={() => { cart.add(p.id, Math.max(1, Math.min(10, qty || 1))); setMsg("Agregado al carrito"); }}>
                🛒 Agregar al carrito
              </button>
            </div>
            {msg && <Link to="/carrito" className="ok-text">✓ {msg} — ver carrito →</Link>}
          </div>
          <ul className="trust-list">
            <li>Precio verificado por el servidor al pagar</li>
            <li>Inventario reservado 15 minutos durante el pago</li>
            <li>Tu tarjeta nunca toca nuestros servidores</li>
          </ul>
        </div>
      </div>

      <ProductReviews productId={p.id} reviews={reviews} onReviewAdded={(review) => setData({ ...data, reviews: [review, ...reviews] })} />
    </>
  );
}
