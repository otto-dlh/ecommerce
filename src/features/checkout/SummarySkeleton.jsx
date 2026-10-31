import { LoadingRegion, Skeleton, TotalsSkeleton } from "../../shared/ui/Skeleton.jsx";
import "./checkout.css";

// Resumen del pedido mientras el servidor calcula la cotización
export function SummarySkeleton({ lines }) {
  return (
    <LoadingRegion label="Calculando resumen…">
      <ul className="summary" aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => <li key={i}><Skeleton width={i % 2 ? 50 : 70} /></li>)}
      </ul>
      <TotalsSkeleton />
    </LoadingRegion>
  );
}
