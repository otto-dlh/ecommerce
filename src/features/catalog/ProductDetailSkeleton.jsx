import { LoadingRegion, Skeleton, SkeletonText } from "../../shared/ui/Skeleton.jsx";
import "./catalog.css";

// Ficha en carga: misma estructura que la ficha real (foto, datos, caja de compra y reseñas)
export function ProductDetailSkeleton() {
  return (
    <LoadingRegion label="Cargando producto…">
      <div className="product-detail" aria-hidden="true">
        <Skeleton variant="block" className="tile-lg" />
        <div className="product-info">
          <Skeleton variant="pill" />
          <h1><Skeleton variant="title" width={70} /></h1>
          <p className="lead"><SkeletonText lines={3} /></p>
          <div className="buy-box">
            <div className="row between">
              <Skeleton variant="title" width={30} className="price xl" />
              <Skeleton variant="pill" />
            </div>
            <div className="row nowrap">
              <Skeleton variant="input" className="qty" />
              <Skeleton variant="button" size="lg" className="grow" />
            </div>
          </div>
          <ul className="trust-list">
            {[60, 70, 50].map((w) => <li key={w}><Skeleton inline width={w} /></li>)}
          </ul>
        </div>
      </div>
      <section className="panel" aria-hidden="true">
        <h2>Reseñas</h2>
        <ul className="reviews">
          {[0, 1].map((i) => (
            <li key={i}>
              <div className="row between nowrap"><Skeleton width={30} /><Skeleton width={20} /></div>
              <p><SkeletonText lines={2} /></p>
              <Skeleton width={40} className="small" />
            </li>
          ))}
        </ul>
      </section>
    </LoadingRegion>
  );
}
