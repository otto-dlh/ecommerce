// Rutas HTTP del resumen del panel.

export function registerReportingRoutes({ add }, { stats }) {
  add("GET", "/api/admin/stats", { perm: "stats:read" }, () => stats.summary());
}
