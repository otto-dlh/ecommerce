import { useMemo } from "react";
import { encode } from "uqr";
import "./qr-code.css";

/** Zona de silencio que exige el estandar QR alrededor del codigo (en modulos). */
const QUIET_ZONE = 4;

/**
 * Codigo QR como SVG propio: sin imagen data: ni HTML inyectado, asi la CSP estricta no cambia
 * (img-src no necesita data:). Un solo <path> con un cuadrado por modulo oscuro.
 */
export function QrCode({ value, label, size = 200 }) {
  const { path, extent } = useMemo(() => {
    const { data, size: modules } = encode(value, { ecc: "M", border: 0 });
    let d = "";
    data.forEach((row, y) => row.forEach((dark, x) => { if (dark) d += `M${x + QUIET_ZONE},${y + QUIET_ZONE}h1v1h-1z`; }));
    return { path: d, extent: modules + QUIET_ZONE * 2 };
  }, [value]);

  return (
    <svg className="qr-code" role="img" aria-label={label} width={size} height={size} viewBox={`0 0 ${extent} ${extent}`} shapeRendering="crispEdges">
      <rect width={extent} height={extent} fill="#fff" />
      <path d={path} fill="#0f172a" />
    </svg>
  );
}
