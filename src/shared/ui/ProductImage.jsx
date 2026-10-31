import { useState } from "react";
import "./product-image.css";

// Muestra la foto del producto (autoalojada en /products) y, si no existe o falla, el emoji sobre degradado.
// Mientras la foto carga, el contenedor muestra un skeleton (clase img-loading).
export function ProductImage({ product, className = "", children }) {
  const [failed, setFailed] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState(null);
  const photo = product.image && !failed;
  const loading = photo && loadedSrc !== product.image;
  return (
    <div
      className={[className, photo && "photo", loading && "img-loading"].filter(Boolean).join(" ")}
      style={photo ? undefined : { background: `linear-gradient(145deg, ${product.color}, ${product.color}b3)` }}
    >
      {photo ? (
        <img src={product.image} alt={product.name} loading="lazy" decoding="async" onLoad={() => setLoadedSrc(product.image)} onError={() => setFailed(true)} />
      ) : (
        <span>{product.emoji}</span>
      )}
      {children}
    </div>
  );
}
