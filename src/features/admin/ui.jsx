// Piezas de interfaz compartidas por las secciones del panel.
import { ListSkeleton, StatsSkeleton, TableSkeleton } from "../../shared/ui/Skeleton.jsx";

const GENERIC_HEADERS = ["", "", "", ""];

/**
 * Estado de carga de una seccion (punto unico para cambiar su apariencia).
 * - headers: encabezados reales de la tabla que se esta cargando (no cambian al llegar los datos)
 * - stats: cantidad de tarjetas de metricas, si la seccion empieza con ellas
 * - list: cantidad de elementos, si la seccion es una lista
 */
export function Loading({ label = "Cargando…", headers, rows = 5, stats = 0, list = 0 }) {
  if (stats) return <StatsSkeleton count={stats} label={label} />;
  if (list) return <ListSkeleton items={list} label={label} />;
  return <TableSkeleton headers={headers ?? GENERIC_HEADERS} rows={rows} label={label} className="panel scroll" />;
}

export function ErrorAlert({ error }) {
  return error ? <p className="alert error">{error}</p> : null;
}

/** Aviso para quien ve una seccion sin permiso de modificarla (p. ej. el auditor). */
export function ReadOnlyNote({ children = "Modo de solo lectura: tu rol puede consultar esta sección, pero no modificarla." }) {
  return <p className="hint">{children}</p>;
}
