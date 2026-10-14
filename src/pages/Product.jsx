import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import { date, money } from "../format.js";
import { useAuth, useCart } from "../state.jsx";
import { ProductTile } from "./Catalog.jsx";

const Stars = ({ n }) => <span className="stars" aria-label={`${n} de 5`}>{"★".repeat(n)}{"☆".repeat(5 - n)}</span>;

export default function Product() {
  const { id } = useParams();
  const { user } = useAuth();
  const cart = useCart();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState("");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [reviewMsg, setReviewMsg] = useState("");

  const [credit, setCredit] = useState(null);

  useEffect(() => {
    api(`/api/products/${encodeURIComponent(id)}`).then(setData).catch((e) => setError(e.message));
    // Atribucion de la foto (archivo estatico generado por scripts/fetch-stock-photos.mjs)
    fetch("/products/credits.json").then((r) => (r.ok ? r.json() : {})).then((c) => setCredit(c[id] ?? null)).catch(() => {});
  }, [id]);

  if (error) return <p className="alert error">{error}</p>;
  if (!data) return <p className="muted center">Cargando…</p>;
  const { product: p, reviews } = data;
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  const submitReview = async (e) => {
    e.preventDefault();
    setReviewMsg("");
    try {
      const d = await api(`/api/products/${p.id}/reviews`, { method: "POST", body: { rating, text } });
      setData({ ...data, reviews: [d.review, ...reviews] });
      setText("");
      setReviewMsg("¡Gracias por tu reseña!");
    } catch (err) {
      setReviewMsg(err.message);
    }
  };

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

      <section className="panel">
        <h2>Reseñas</h2>
        {user ? (
          <form className="review-form" onSubmit={submitReview}>
            <label>
              Calificación
              <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
              </select>
            </label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Cuéntanos tu experiencia…" required />
            <p className="hint">
              Prueba T07: escribe <code>{"<img src=x onerror=alert(1)>"}</code>. React lo muestra como texto y la CSP bloquea scripts en línea.
            </p>
            <button className="btn">Publicar reseña</button>
            {reviewMsg && <span className="muted"> {reviewMsg}</span>}
          </form>
        ) : (
          <p className="muted"><Link to="/login">Inicia sesión</Link> para dejar una reseña.</p>
        )}
        {reviews.length === 0 && <p className="muted">Aún no hay reseñas.</p>}
        <ul className="reviews">
          {reviews.map((r) => (
            <li key={r.id}>
              <div className="row between"><b>{r.userName}</b><Stars n={r.rating} /></div>
              {/* Se renderiza como texto: React codifica la salida segun contexto (ASVS v5.0.0-1.2.1) */}
              <p>{r.text}</p>
              <small className="muted">{date(r.createdAt)}</small>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
