import { Link } from "react-router-dom";
import { money } from "../../shared/lib/format.js";
import { ProductTile } from "./ProductTile.jsx";
import "./catalog.css";

/** Tarjeta de un producto en la grilla del catalogo, con boton para agregarlo al carrito. */
export function ProductCard({ product: p, onAdd }) {
  return (
    <article className="card product-card">
      <Link to={`/producto/${p.id}`} className="card-media">
        <span className="pill glass">{p.category}</span>
        {p.stock === 0 ? (
          <span className="pill out stock-pill">Agotado</span>
        ) : p.stock <= 3 ? (
          <span className="pill hot stock-pill">🔥 Quedan {p.stock}</span>
        ) : null}
        <ProductTile product={p} />
      </Link>
      <div className="card-body">
        <h3><Link to={`/producto/${p.id}`}>{p.name}</Link></h3>
        <span className="stock">{p.stock > 0 ? `${p.stock} disponibles` : "Sin existencias"}</span>
        <div className="card-foot">
          <strong className="price">{money(p.price)}</strong>
          <button className="btn add-btn" disabled={p.stock === 0} onClick={() => onAdd(p)} aria-label={`Agregar ${p.name} al carrito`} title="Agregar al carrito">+</button>
        </div>
      </div>
    </article>
  );
}
