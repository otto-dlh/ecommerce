// Controladores de la administracion del inicio de sesion (seccion "Accesos" del panel).
const READ = { perm: "access:read" };
const MANAGE = { perm: "access:manage" };

export function registerAccessRoutes({ add }, { access }) {
  add("GET", "/api/admin/access/summary", READ, () => access.summary());

  add("GET", "/api/admin/access/sessions", READ, async (ctx) => ({ sessions: await access.listSessions(ctx) }));
  add("DELETE", "/api/admin/access/sessions/:id", MANAGE, async (ctx) => {
    await access.revokeSession(ctx, ctx.params.id);
    return { ok: true };
  });

  add("GET", "/api/admin/access/lockouts", READ, async () => ({ lockouts: await access.listLockouts() }));
  add("GET", "/api/admin/access/attempts", READ, async () => ({ attempts: await access.listFailedAttempts() }));
  add("POST", "/api/admin/access/unlock", MANAGE, async (ctx) => {
    await access.unlock(ctx, ctx.body);
    return { ok: true };
  });

  add("POST", "/api/admin/access/users/:id/revoke-sessions", MANAGE, async (ctx) => ({ revoked: await access.revokeUserSessions(ctx, ctx.params.id) }));
  add("POST", "/api/admin/access/users/:id/force-password", MANAGE, (ctx) => access.forcePasswordChange(ctx, ctx.params.id));
  add("POST", "/api/admin/access/users/:id/reset-mfa", MANAGE, async (ctx) => {
    await access.resetMfa(ctx, ctx.params.id);
    return { ok: true };
  });

  add("GET", "/api/admin/access/policy", READ, () => access.getPolicy());
  add("PUT", "/api/admin/access/policy", MANAGE, async (ctx) => ({ policy: await access.updatePolicy(ctx, ctx.body) }));
}
