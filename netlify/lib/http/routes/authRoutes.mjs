// Controladores de autenticacion y cuenta. Solo traducen HTTP ↔ casos de uso.

export function registerAuthRoutes({ add }, { auth }) {
  add("GET", "/api/auth/me", { passwordChangeExempt: true }, (ctx) => auth.me(ctx));

  add("POST", "/api/auth/register", {}, async (ctx) => {
    const result = await auth.register(ctx, ctx.body);
    ctx.status = 201;
    return ctx.startSession(result);
  });

  add("POST", "/api/auth/login", {}, async (ctx) => {
    const result = await auth.login(ctx, ctx.body);
    return result.mfaRequired ? result : ctx.startSession(result);
  });

  add("POST", "/api/auth/mfa/verify", {}, async (ctx) => ctx.startSession(await auth.verifyMfa(ctx, ctx.body)));

  add("POST", "/api/auth/logout", { auth: true, passwordChangeExempt: true }, async (ctx) => {
    await auth.logout(ctx);
    ctx.endSession();
    return { ok: true };
  });

  add("POST", "/api/auth/logout-all", { auth: true }, async (ctx) => {
    const revoked = await auth.logoutAll(ctx);
    ctx.endSession();
    return { ok: true, revoked };
  });

  add("POST", "/api/auth/password", { auth: true, passwordChangeExempt: true }, async (ctx) => {
    return { ok: true, ...ctx.startSession(await auth.changePassword(ctx, ctx.body)) };
  });

  add("POST", "/api/auth/mfa/setup", { auth: true }, (ctx) => auth.startMfaSetup(ctx));

  add("POST", "/api/auth/mfa/enable", { auth: true }, async (ctx) => {
    await auth.enableMfa(ctx, ctx.body);
    return { ok: true };
  });

  add("POST", "/api/auth/mfa/disable", { auth: true }, async (ctx) => {
    await auth.disableMfa(ctx, ctx.body);
    return { ok: true };
  });
}
