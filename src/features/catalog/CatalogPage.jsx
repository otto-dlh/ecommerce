import { useEffect, useReducer, useState } from "react";
import { cartApi, catalogApi } from "../../shared/api/index.js";
import { useLiveRefresh } from "../../shared/realtime/RealtimeProvider.jsx";
import { ProductGridSkeleton, Skeleton } from "../../shared/ui/Skeleton.jsx";
import { useCart } from "../cart/index.js";
import { Hero } from "./Hero.jsx";
import { CouponStrip } from "./CouponStrip.jsx";
import { ProductCard } from "./ProductCard.jsx";
import "./catalog.css";

export function CatalogPage() {
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
    catalogApi.categories().then((d) => setCategories(d.categories)).catch(() => setCategories([]));
    cartApi.publicCoupons().then((d) => setCoupons(d.coupons)).catch(() => setCoupons([]));
  }, [version]);

  useEffect(() => {
    const t = setTimeout(() => {
      catalogApi.searchProducts({ q, category, sort })
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

      <CouponStrip coupons={coupons} />

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
          {products.map((p) => <ProductCard key={p.id} product={p} onAdd={add} />)}
        </div>
      )}
    </>
  );
}
