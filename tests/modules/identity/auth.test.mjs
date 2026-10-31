import { test } from "node:test";
import assert from "node:assert/strict";
import { newContainer, anonCtx, loginAs, DEMO } from "../../helpers.mjs";
import { totpNow } from "../../../server/shared/security/crypto.mjs";
import { UnauthenticatedError, TooManyRequestsError, ValidationError } from "../../../server/shared/domain/errors.mjs";
import { GENERIC_LOGIN_ERROR } from "../../../server/modules/identity/domain/users.mjs";

test("login correcto: sesion, CSRF, canal realtime privado y permisos del rol", async () => {
  const c = await newContainer();
  const result = await c.services.auth.login(anonCtx(), { email: DEMO.auditor[0], password: DEMO.auditor[1] });
  assert.match(result.sessionToken, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(result.csrf);
  assert.match(result.realtimeChannel, /^s:[A-Za-z0-9_-]{22}$/);
  assert.equal(result.user.role, "auditor");
  assert.ok(result.user.permissions.includes("audit:read"));
  // El almacen guarda solo el hash del token
  const stored = await c.repos.sessions.list();
  assert.equal(JSON.stringify(stored).includes(result.sessionToken), false);
});

test("T01: el error no revela si el correo existe", async () => {
  const c = await newContainer();
  const wrongPassword = c.services.auth.login(anonCtx(), { email: DEMO.cliente[0], password: "incorrecta-123" });
  const unknownEmail = c.services.auth.login(anonCtx(), { email: "nadie@tienda.test", password: "incorrecta-123" });
  await assert.rejects(wrongPassword, (err) => err instanceof UnauthenticatedError && err.message === GENERIC_LOGIN_ERROR);
  await assert.rejects(unknownEmail, (err) => err instanceof UnauthenticatedError && err.message === GENERIC_LOGIN_ERROR);
});

test("T01: tras 5 fallos la cuenta se bloquea para esa IP, incluso con la contrasena correcta", async () => {
  const c = await newContainer();
  const ctx = anonCtx();
  for (let i = 0; i < 5; i++) {
    await assert.rejects(c.services.auth.login(ctx, { email: DEMO.cliente[0], password: `incorrecta-${i}` }), UnauthenticatedError);
  }
  await assert.rejects(c.services.auth.login(ctx, { email: DEMO.cliente[0], password: DEMO.cliente[1] }), (err) => err instanceof TooManyRequestsError && err.details.retryAfter > 0);
  // Desde otra IP la cuenta sigue funcionando (el bloqueo es por IP + cuenta)
  await assert.doesNotReject(c.services.auth.login(anonCtx(), { email: DEMO.cliente[0], password: DEMO.cliente[1] }));
  const actions = (await c.services.audit.list()).map((e) => e.action);
  assert.ok(actions.includes("ratelimit.block"));
});

test("registro: el rol enviado se ignora (asignacion masiva) y el duplicado da error generico", async () => {
  const c = await newContainer();
  const result = await c.services.auth.register(anonCtx(), { name: "Eva", email: "eva@tienda.test", password: "una-clave-bien-larga", role: "admin" });
  assert.equal(result.user.role, "cliente");
  await assert.rejects(
    c.services.auth.register(anonCtx(), { name: "Eva", email: "eva@tienda.test", password: "una-clave-bien-larga" }),
    (err) => err instanceof ValidationError && !/existe|registrad/i.test(err.message),
  );
});

test("MFA TOTP: activacion, desafio al iniciar sesion y anti-replay del codigo", async () => {
  const c = await newContainer();
  const ctx = await loginAs(c, "admin");
  const { secret } = await c.services.auth.startMfaSetup(ctx);
  const stored = await c.repos.users.findById(ctx.user.id);
  assert.notEqual(stored.mfa.pendingSecret, secret, "la semilla se guarda cifrada");

  // Instante fijo: los codigos no dependen de cruzar el borde de una ventana de 30 s
  const t0 = Date.now();
  await c.services.auth.enableMfa({ ...ctx, user: stored }, { code: totpNow(secret, t0) });
  const challenge = await c.services.auth.login(anonCtx(), { email: DEMO.admin[0], password: DEMO.admin[1] });
  assert.equal(challenge.mfaRequired, true);

  // El codigo ya usado para activar no se acepta otra vez
  await assert.rejects(c.services.auth.verifyMfa(anonCtx(), { mfaToken: challenge.mfaToken, code: totpNow(secret, t0) }), /Código incorrecto/);
  const nextCode = totpNow(secret, t0 + 30_000);
  const session = await c.services.auth.verifyMfa(anonCtx(), { mfaToken: challenge.mfaToken, code: nextCode });
  assert.ok(session.sessionToken);
  // El desafio se consume: no sirve dos veces
  await assert.rejects(c.services.auth.verifyMfa(anonCtx(), { mfaToken: challenge.mfaToken, code: nextCode }), UnauthenticatedError);
});

test("cambiar la contrasena cierra las demas sesiones", async () => {
  const c = await newContainer();
  const other = await loginAs(c, "cliente");
  const ctx = await loginAs(c, "cliente");
  const result = await c.services.auth.changePassword(ctx, { current: DEMO.cliente[1], next: "Nueva#Clave2026!" });
  assert.equal(await c.services.sessions.resolve(other.token), null);
  assert.equal(await c.services.sessions.resolve(ctx.token), null, "la sesion actual rota");
  assert.ok(await c.services.sessions.resolve(result.sessionToken));
});

test("sesion vencida por inactividad segun la politica", async () => {
  const c = await newContainer();
  const ctx = await loginAs(c, "cliente");
  const longAgo = new Date(Date.now() - 31 * 60 * 1000).toISOString();
  await c.repos.sessions.touch(ctx.session.keyHash, longAgo);
  assert.equal(await c.services.sessions.resolve(ctx.token), null);
});
