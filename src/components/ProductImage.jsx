import { useState } from "react";

// Muestra la foto del producto (autoalojada en /products) y, si no existe o falla, el emoji sobre degradado.
export function ProductImage({ product, className = "", children }) {
  const [failed, setFailed] = useState(false);
  const photo = product.image && !failed;
  return (
    <div
      className={`${className} ${photo ? "photo" : ""}`}
      style={photo ? undefined : { background: `linear-gradient(145deg, ${product.color}, ${product.color}b3)` }}
    >
      {photo ? (
        <img src={product.image} alt={product.name} loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <span>{product.emoji}</span>
      )}
      {children}
    </div>
  );
}
