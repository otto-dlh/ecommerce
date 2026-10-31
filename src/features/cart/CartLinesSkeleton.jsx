import { LoadingRegion, Skeleton, SkeletonText } from "../../shared/ui/Skeleton.jsx";
import "./cart.css";

// Líneas del carrito mientras el servidor calcula la cotización (misma .cart-line que las reales)
export function CartLinesSkeleton({ count }) {
  return (
    <LoadingRegion className="panel" label="Cargando tu carrito…">
      {Array.from({ length: count }, (_, i) => (
        <div className="cart-line" key={i} aria-hidden="true">
          <span className="emoji"><Skeleton variant="block" /></span>
          <SkeletonText lines={2} className="grow sk-cart-name" />
          <Skeleton variant="input" className="qty" />
          <span className="line-total sk-cart-total"><Skeleton inline width={80} /></span>
          <Skeleton variant="button" size="sm" />
        </div>
      ))}
    </LoadingRegion>
  );
}
