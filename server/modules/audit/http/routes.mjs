// Rutas HTTP de la bitacora de auditoria (solo lectura, con verificacion de integridad).

export function registerAuditRoutes({ add }, { audit }) {
  add("GET", "/api/admin/audit", { perm: "audit:read" }, async (ctx) => {
    const limit = Math.min(300, Math.max(10, Number(ctx.query.get("limit")) || 150));
    return { entries: await audit.list({ limit }) };
  });
}
