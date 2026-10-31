import { useState } from "react";
import { Link } from "react-router-dom";
import { catalogApi } from "../../shared/api/index.js";
import { date } from "../../shared/lib/format.js";
import { useAuth } from "../auth/index.js";
import { Stars } from "./Stars.jsx";
import "./catalog.css";

/** Reseñas de un producto: formulario para publicar (con sesion) y lista de reseñas. */
export function ProductReviews({ productId, reviews, onReviewAdded }) {
  const { user } = useAuth();
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [reviewMsg, setReviewMsg] = useState("");

  const submitReview = async (e) => {
    e.preventDefault();
    setReviewMsg("");
    try {
      const d = await catalogApi.createReview(productId, { rating, text });
      onReviewAdded(d.review);
      setText("");
      setReviewMsg("¡Gracias por tu reseña!");
    } catch (err) {
      setReviewMsg(err.message);
    }
  };

  return (
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
  );
}
