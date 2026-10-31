import { ProductImage } from "../../shared/ui/ProductImage.jsx";
import "./catalog.css";

/** Foto (o emoji) de un producto en formato ficha: "md" en el catalogo, "lg" en la ficha del producto. */
export function ProductTile({ product, size = "md" }) {
  return <ProductImage product={product} className={`tile tile-${size}`} />;
}
