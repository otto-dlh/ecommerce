import { Skeleton, SkeletonText } from "../../shared/ui/Skeleton.jsx";
import "./catalog.css";

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

/** Cupones vigentes bajo la portada (null = todavia cargando; sin cupones no se muestra nada). */
export function CouponStrip({ coupons }) {
  if (coupons === null) return <CouponStripSkeleton />;
  if (coupons.length === 0) return null;
  return (
    <div className="coupon-strip">
      {coupons.map((c) => (
        <div key={c.code} className="ticket">
          <span className="ticket-code">{c.code}</span>
          <span>{c.label}</span>
        </div>
      ))}
    </div>
  );
}
