import { FieldSkeleton, LoadingRegion, Skeleton } from "../../shared/ui/Skeleton.jsx";
import { SandboxHead } from "./SandboxHead.jsx";
import "./checkout.css";

// Pasarela en carga: tarjeta, monto y formulario simulados dentro del mismo recuadro .sandbox
export function PaySkeleton() {
  return (
    <LoadingRegion className="sandbox" label="Cargando pedido…">
      <SandboxHead />
      <div aria-hidden="true">
        <Skeleton variant="block" className="sk-card-visual" />
        <div className="pay-amount">
          <Skeleton width={40} />
          <Skeleton variant="title" width={30} className="price" />
        </div>
        <div className="form">
          <FieldSkeleton />
          <div className="row">
            <FieldSkeleton className="grow" />
            <FieldSkeleton className="grow" />
          </div>
          <FieldSkeleton />
          <Skeleton variant="button" width={100} />
        </div>
      </div>
    </LoadingRegion>
  );
}
