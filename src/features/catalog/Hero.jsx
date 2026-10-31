import { Link } from "react-router-dom";
import { ProductImage } from "../../shared/ui/ProductImage.jsx";
import { Skeleton } from "../../shared/ui/Skeleton.jsx";
import "./catalog.css";

/** Portada del catalogo: mensaje principal y vitrina con los productos destacados. */
export function Hero({ products, loading }) {
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
