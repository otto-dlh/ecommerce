import { useEffect, useReducer, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { money } from "../format.js";
import { useCart } from "../state.jsx";
import { ProductImage } from "../components/ProductImage.jsx";
import { useLiveRefresh } from "../realtime/RealtimeProvider.jsx";
import { ProductGridSkeleton, Skeleton, SkeletonText } from "../components/Skeleton.jsx";

export function ProductTile({ product, size = "md" }) {
  return <ProductImage product={product} className={`tile tile-${size}`} />;
}

// Cupones en carga: mismas tarjetas punteadas (.ticket) con código y texto simulados
function CouponStripSkeleton({ count = 3 }) {
  return (
    <div className="coupon-strip" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="ticket">
          <Skeleton variant="pill" className="sk-code" />
          <SkeletonText lines={2} className="grow" />
        </div>
      ))}
    </div>
  );
}

function Hero({ products, loading }) {
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
        {loading
          ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} variant="block" className="float-tile sk-dark" />)
          : featured.map((p) => <ProductImage key={p.id} product={p} className="float-tile" />)}
        <div className="glass-card">
          <b><span className="check">✓</span> Pago verificado</b>
          <span>Webhook HMAC-SHA256 · idempotente</span>
        </div>
      </div>
    </section>
  );
}

export default function Catalog() {
  // Cada aviso del canal publico sube la version y las cargas existentes se repiten
  const [version, bump] = useReducer((n) => n + 1, 0);
  useLiveRefresh(["catalog.products", "catalog.stock", "catalog.categories", "catalog.coupons"], bump);
  const [products, setProducts] = useState(null);
  const [featured, setFeatured] = useState(null);
  // null = todavía cargando (se muestra su skeleton)
  const [categories, setCategories] = useState(null);
  const [coupons, setCoupons] = useState(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("relevancia");
  const [error, setError] = useState("");
  const [added, setAdded] = useState("");
  const cart = useCart();

  useEffect(() => {
    api("/api/categories").then((d) => setCategories(d.categories)).catch(() => setCategories([]));
    api("/api/coupons").then((d) => setCoupons(d.coupons)).catch(() => setCoupons([]));
  }, [version]);

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
  }, [q, category, sort, version]);

  const add = (p) => {
    cart.add(p.id);
    setAdded(p.name);
    setTimeout(() => setAdded(""), 1800);
  };

  return (
    <>
      <Hero products={featured} loading={!featured && !error} />

      {coupons === null ? (
        <CouponStripSkeleton />
      ) : coupons.length > 0 && (
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
          <span className="muted">{products ? `${products.length} productos` : !error && <Skeleton inline />}</span>
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
        {categories === null
          ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} variant="pill" className="sk-chip" />)
          : categories.map((c) => (
            <button key={c.id} className={`chip ${category === c.id ? "active" : ""}`} onClick={() => setCategory(c.id)} title={c.description || undefined}>{c.name}</button>
          ))}
      </div>

      {error && <p className="alert error">{error}</p>}
      {added && <div className="toast">✓ “{added}” agregado al carrito</div>}
      {!products ? (
        !error && <ProductGridSkeleton count={8} />
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
