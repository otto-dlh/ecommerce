import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { money } from "../format.js";
import { useCart } from "../state.jsx";
import { ProductImage } from "../components/ProductImage.jsx";

export function ProductTile({ product, size = "md" }) {
  return <ProductImage product={product} className={`tile tile-${size}`} />;
}

function Hero({ products }) {
  const featured = products?.slice(0, 4) ?? [];
  return (
    <section className="hero">
      <div className="hero-grid" />
      <div className="hero-glow" />
      <div>
        <span className="eyebrow"><span className="dot" /> Compra protegida · OWASP ASVS 5.0.0</span>
        <h1>
          Lo mejor de Guatemala,<br />
          <span className="gradient-text">comprado sin riesgos.</span>
        </h1>
        <p>Café de altura, artesanías y tecnología en una tienda construida con seguridad desde el diseño: sesiones blindadas, pagos tokenizados y auditoría de cada operación.</p>
        <div className="hero-cta">
          <a href="#catalogo" className="btn lg">Explorar catálogo →</a>
          <Link to="/seguridad" className="btn glass lg">🛡️ Laboratorio de seguridad</Link>
        </div>
        <div className="hero-stats">
          <div><b>14</b><span>amenazas STRIDE mitigadas</span></div>
          <div><b>29</b><span>requisitos ASVS</span></div>
          <div><b>0</b><span>tarjetas almacenadas</span></div>
        </div>
      </div>
      <div className="showcase" aria-hidden="true">
        {featured.map((p) => (
          <ProductImage key={p.id} product={p} className="float-tile" />
        ))}
        <div className="glass-card">
          <b><span className="check">✓</span> Pago verificado</b>
          <span>Webhook HMAC-SHA256 · idempotente</span>
        </div>
      </div>
    </section>
  );
}

export default function Catalog() {
  const [products, setProducts] = useState(null);
  const [featured, setFeatured] = useState(null);
  const [categories, setCategories] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("relevancia");
  const [error, setError] = useState("");
  const [added, setAdded] = useState("");
  const cart = useCart();

  useEffect(() => {
    api("/api/categories").then((d) => setCategories(d.categories)).catch(() => {});
    api("/api/coupons").then((d) => setCoupons(d.coupons)).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams({ q, category, sort });
      api(`/api/products?${params}`)
        .then((d) => {
          setProducts(d.products);
          setFeatured((f) => f ?? d.products.filter((p) => p.stock > 1).slice(0, 4));
          setError("");
        })
        .catch((e) => setError(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [q, category, sort]);

  const add = (p) => {
    cart.add(p.id);
    setAdded(p.name);
    setTimeout(() => setAdded(""), 1800);
  };

  return (
    <>
      <Hero products={featured} />

      {coupons.length > 0 && (
        <div className="coupon-strip">
          {coupons.map((c) => (
            <div key={c.code} className="ticket">
              <span className="ticket-code">{c.code}</span>
              <span>{c.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="section-head" id="catalogo">
        <div>
          <h2>Catálogo</h2>
          <span className="muted">{products ? `${products.length} productos` : "Cargando…"}</span>
        </div>
        <div className="toolbar">
          <label className="search">
            <input type="search" placeholder="Buscar café, audífonos, textiles…" value={q} maxLength={60} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
          </label>
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar">
            <option value="relevancia">Destacados</option>
            <option value="precio-asc">Precio: menor a mayor</option>
            <option value="precio-desc">Precio: mayor a menor</option>
            <option value="nombre">Nombre A–Z</option>
          </select>
        </div>
      </div>

      <div className="chips">
        <button className={`chip ${category === "" ? "active" : ""}`} onClick={() => setCategory("")}>Todo</button>
        {categories.map((c) => (
          <button key={c} className={`chip ${category === c ? "active" : ""}`} onClick={() => setCategory(c)}>{c}</button>
        ))}
      </div>

      {error && <p className="alert error">{error}</p>}
      {added && <div className="toast">✓ “{added}” agregado al carrito</div>}
      {!products ? (
        <div className="grid">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton" />)}</div>
      ) : products.length === 0 ? (
        <div className="empty"><span className="big">🔍</span><p className="muted">No encontramos productos con esa búsqueda.</p></div>
      ) : (
        <div className="grid">
          {products.map((p) => (
            <article key={p.id} className="card product-card">
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
                  <button className="btn add-btn" disabled={p.stock === 0} onClick={() => add(p)} aria-label={`Agregar ${p.name} al carrito`} title="Agregar al carrito">+</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
