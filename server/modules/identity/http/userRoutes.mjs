// Controladores de usuarios y roles del panel.

export function registerUserRoutes({ add }, { userAdmin }) {
  add("GET", "/api/admin/users", { perm: "users:read" }, async () => ({ users: await userAdmin.list() }));
  add("PUT", "/api/admin/users/:id", { perm: "users:manage" }, async (ctx) => ({ user: await userAdmin.update(ctx, ctx.params.id, ctx.body) }));
}
