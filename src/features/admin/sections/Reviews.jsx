import { useState } from "react";
import { Link } from "react-router-dom";
import { catalogAdminApi } from "../../../shared/api/index.js";
import { date } from "../../../shared/lib/format.js";
import { useApi, useAction } from "../../../shared/hooks/useApi.js";
import { useLiveRefresh } from "../../../shared/realtime/RealtimeProvider.jsx";
import { ErrorAlert, Loading } from "../ui.jsx";

const FILTERS = [
  { key: "", label: "Todas" },
  { key: "false", label: "Visibles" },
  { key: "true", label: "Ocultas" },
];

const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);

function ReviewCard({ review, onToggle }) {
  return (
    <li className={review.hidden ? "inactive" : ""}>
      <div className="row between">
        <span aria-label={`${review.rating} de 5`}>{stars(review.rating)}</span>
        {review.hidden && <span className="status muted">Oculta</span>}
      </div>
      {/* El texto se muestra como texto: React escapa cualquier HTML (T07) */}
      <p>{review.text}</p>
      <small className="muted">{review.userName} · <Link to={`/producto/${review.productId}`}>{review.productName}</Link> · {date(review.createdAt)}</small>
      <div className="row">
        <button className="btn ghost sm" onClick={() => onToggle(review)}>{review.hidden ? "Restaurar" : "Ocultar"}</button>
      </div>
    </li>
  );
}

/** Moderacion de resenas: ocultar no borra; la accion queda auditada y es reversible. */
export default function Reviews() {
  const [filter, setFilter] = useState("");
  const { data, error, load, setError } = useApi(() => catalogAdminApi.reviews({ hidden: filter }), [filter]);
  const run = useAction(load, setError);
  useLiveRefresh("admin.reviews", load);
  const toggle = (review) => run(() => (review.hidden ? catalogAdminApi.restoreReview(review.id) : catalogAdminApi.hideReview(review.id)));

  return (
    <>
      <div className="chips" role="tablist" aria-label="Filtrar reseñas">
        {FILTERS.map((f) => <button key={f.key} role="tab" aria-selected={filter === f.key} className={`chip ${filter === f.key ? "active" : ""}`} onClick={() => setFilter(f.key)}>{f.label}</button>)}
      </div>
      <ErrorAlert error={error} />
      {!data ? <Loading list={4} label="Cargando reseñas…" /> : data.reviews.length === 0 ? <p className="muted">No hay reseñas en este filtro.</p> : (
        <ul className="reviews">{data.reviews.map((r) => <ReviewCard key={r.id} review={r} onToggle={toggle} />)}</ul>
      )}
    </>
  );
}
