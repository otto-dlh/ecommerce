import { LoadingRegion, Skeleton, SkeletonText, TableRowsSkeleton, TotalsSkeleton } from "../../shared/ui/Skeleton.jsx";
import "./orders.css";

// Detalle en carga: encabezado, tabla de productos con totales y panel de envío/historial
export function OrderDetailSkeleton({ headers }) {
  return (
    <LoadingRegion label="Cargando pedido…">
      <div aria-hidden="true">
        <span className="back"><Skeleton inline /></span>
        <div className="row between">
          <h1 className="grow"><Skeleton variant="title" width={40} /></h1>
          <Skeleton variant="pill" />
        </div>
        <div className="two-col">
          <div className="panel scroll">
            <table className="table">
              <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody><TableRowsSkeleton rows={2} columns={headers.length} /></tbody>
            </table>
            <TotalsSkeleton />
          </div>
          <aside className="panel">
            <h3>Envío</h3>
            <p><SkeletonText lines={4} /></p>
            <h3>Historial</h3>
            <ol className="timeline">
              {[0, 1].map((i) => <li key={i}><Skeleton width={40} /><Skeleton width={60} className="small" /></li>)}
            </ol>
          </aside>
        </div>
      </div>
    </LoadingRegion>
  );
}
