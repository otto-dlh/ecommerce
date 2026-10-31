// Rutas HTTP del modulo de clientes: direcciones propias y consulta de clientes en el panel (solo lectura).

export function registerCustomerRoutes({ add }, { addresses, customers }) {
  // ---- Direcciones guardadas del cliente ----
  add("GET", "/api/addresses", { auth: true }, async (ctx) => ({ addresses: await addresses.list(ctx.user) }));
  add("POST", "/api/addresses", { auth: true }, async (ctx) => {
    const address = await addresses.create(ctx.user, ctx.body);
    ctx.status = 201;
    return { address };
  });
  add("DELETE", "/api/addresses/:id", { auth: true }, async (ctx) => {
    await addresses.remove(ctx, ctx.params.id);
    return { ok: true };
  });

  // ---- Clientes en el panel (cada detalle consultado queda auditado) ----
  add("GET", "/api/admin/customers", { perm: "customers:read" }, async () => ({ customers: await customers.list() }));
  add("GET", "/api/admin/customers/:id", { perm: "customers:read" }, (ctx) => customers.detail(ctx, ctx.params.id));
}
