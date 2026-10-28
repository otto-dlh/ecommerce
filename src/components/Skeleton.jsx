import { Fragment } from "react";

// Skeletons: marcadores de posición con la forma del contenido mientras llegan los datos.
// Las piezas son decorativas (aria-hidden); LoadingRegion marca el contenedor con aria-busy
// y deja un texto solo para lectores de pantalla.

const range = (n) => Array.from({ length: n }, (_, i) => i);
const cx = (...names) => names.filter(Boolean).join(" ");

// Anchos alternados para que las filas simuladas no se vean idénticas
const ROW_WIDTHS = [70, 50, 80, 40, 60];

/**
 * Pieza base.
 * - variant: "line" (renglón de texto) | "title" (encabezado) | "block" (área; alto por clase)
 *            | "circle" | "pill" (etiqueta o estado) | "button" | "input"
 * - width: porcentaje del contenedor en múltiplos de 10 (10–100)
 * - size: "sm" | "lg" para botones (mismo alto que .btn.sm y .btn.lg)
 * - inline: dentro de una línea de texto (inline-block)
 * - className: clases de maquetación existentes (tile-md, add-btn, price…) para heredar su tamaño
 */
export function Skeleton({ variant = "line", width, size, inline = false, className }) {
  return (
    <span
      className={cx("sk", `sk-${variant}`, width && `sk-w-${width}`, size && `sk-${size}`, inline && "sk-inline", className)}
      aria-hidden="true"
    />
  );
}

/** Párrafo simulado: el último renglón es más corto, como en un texto real. */
export function SkeletonText({ lines = 3, className }) {
  return (
    <span className={cx("sk-text", className)} aria-hidden="true">
      {range(lines).map((i) => (
        <Skeleton key={i} width={lines > 1 && i === lines - 1 ? 60 : undefined} />
      ))}
    </span>
  );
}

/**
 * Contenedor en carga: aria-busy + texto para lectores de pantalla.
 * Con `as` y `className` puede ser la misma grilla o panel del contenido real, así no hay saltos de diseño.
 */
export function LoadingRegion({ label = "Cargando…", as: Tag = "div", className, children }) {
  return (
    <Tag className={className} aria-busy="true">
      <span className="sr-only" role="status">{label}</span>
      {children}
    </Tag>
  );
}

/** Campo de formulario: etiqueta + input. */
export function FieldSkeleton({ className }) {
  return (
    <div className={cx("sk-field", className)} aria-hidden="true">
      <Skeleton width={30} />
      <Skeleton variant="input" />
    </div>
  );
}

/** Tarjeta del catálogo: foto, nombre, existencias, precio y botón de agregar. */
export function ProductCardSkeleton() {
  return (
    <div className="card" aria-hidden="true">
      <div className="card-media">
        <Skeleton variant="block" className="tile-md" />
      </div>
      <div className="card-body">
        <h3><Skeleton variant="title" width={80} /></h3>
        <Skeleton width={40} className="stock" />
        <div className="card-foot">
          <Skeleton variant="title" width={30} className="price" />
          <Skeleton variant="button" className="add-btn" />
        </div>
      </div>
    </div>
  );
}

/** Grilla de productos en carga (misma .grid que el catálogo). */
export function ProductGridSkeleton({ count = 8, label = "Cargando productos…" }) {
  return (
    <LoadingRegion className="grid" label={label}>
      {range(count).map((i) => <ProductCardSkeleton key={i} />)}
    </LoadingRegion>
  );
}

/**
 * Filas simuladas para el <tbody> de una tabla real.
 * variants: variante de Skeleton por columna (p. ej. ["line", "line", "pill"]); por defecto todas "line".
 */
export function TableRowsSkeleton({ rows = 5, columns = 4, variants = [] }) {
  return range(rows).map((r) => (
    <tr key={r} aria-hidden="true">
      {range(columns).map((c) => {
        const variant = variants[c] ?? "line";
        return (
          <td key={c}>
            <Skeleton variant={variant} width={variant === "line" ? ROW_WIDTHS[(r + c) % ROW_WIDTHS.length] : undefined} />
          </td>
        );
      })}
    </tr>
  ));
}

/** Tabla en carga dentro de su panel: encabezados reales (no cambian) y filas simuladas. */
export function TableSkeleton({ headers, rows = 5, variants, label = "Cargando…", className = "panel" }) {
  return (
    <LoadingRegion className={className} label={label}>
      <table className="table" aria-hidden="true">
        <thead><tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody><TableRowsSkeleton rows={rows} columns={headers.length} variants={variants} /></tbody>
      </table>
    </LoadingRegion>
  );
}

/** Lista simple (.plain): un renglón de texto y un botón pequeño por elemento. */
export function ListSkeleton({ items = 3, label = "Cargando…" }) {
  return (
    <LoadingRegion label={label}>
      <ul className="plain" aria-hidden="true">
        {range(items).map((i) => (
          <li key={i} className="row between nowrap">
            <Skeleton width={ROW_WIDTHS[i % ROW_WIDTHS.length]} />
            <Skeleton variant="button" size="sm" />
          </li>
        ))}
      </ul>
    </LoadingRegion>
  );
}

/** Resumen de importes (.totals): renglones de concepto/monto y el total. Va dentro de un LoadingRegion. */
export function TotalsSkeleton({ rows = 2 }) {
  return (
    <div className="totals" aria-hidden="true">
      {range(rows).map((i) => (
        <Fragment key={i}>
          <Skeleton width={i % 2 ? 30 : 40} />
          <Skeleton className="sk-amount" />
        </Fragment>
      ))}
      <span className="total"><Skeleton variant="title" width={30} /></span>
      <span className="total"><Skeleton variant="title" className="sk-amount" /></span>
    </div>
  );
}

/** Tarjetas de métricas (.stats > .stat) del panel de administración. */
export function StatsSkeleton({ count = 4, label = "Cargando métricas…" }) {
  return (
    <LoadingRegion className="stats" label={label}>
      {range(count).map((i) => (
        <div key={i} className="stat" aria-hidden="true">
          <Skeleton width={60} />
          <Skeleton variant="block" width={40} className="sk-stat-value" />
        </div>
      ))}
    </LoadingRegion>
  );
}
