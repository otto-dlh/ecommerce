import { test } from "node:test";
import assert from "node:assert/strict";
import { newContainer, loginAs, anonCtx, DEMO } from "../../helpers.mjs";
import { ForbiddenError, TooManyRequestsError, ValidationError } from "../../../server/shared/domain/errors.mjs";

test("forzar cambio de contraseña: revoca sesiones, entrega una temporal y exige cambiarla", async () => {
  const c = await newContainer();
  const admin = await loginAs(c, "admin");
  const cliente = await loginAs(c, "cliente");
  const { temporaryPassword } = await c.services.access.forcePasswordChange(admin, cliente.user.id);
  assert.equal(await c.services.sessions.resolve(cliente.token), null, "la sesión anterior se revoca");
  await assert.rejects(c.services.auth.login(anonCtx(), { email: DEMO.cliente[0], password: DEMO.cliente[1] }), /incorrectos/);

  const temp = await c.services.auth.login(anonCtx(), { email: DEMO.cliente[0], password: temporaryPassword });
  assert.equal(temp.user.mustChangePassword, true);
  const { user, session } = await c.services.sessions.resolve(temp.sessionToken);
  const changed = await c.services.auth.changePassword({ ...anonCtx(), user, session }, { current: temporaryPassword, next: "Nueva#Clave2026!" });
  assert.equal(changed.user.mustChangePassword, false);

  const entry = (await c.services.audit.list()).find((e) => e.action === "access.force_password");
  assert.equal(JSON.stringify(entry).includes(temporaryPassword), false, "la contraseña temporal nunca se registra");
});

test("ningún administrador puede aplicarse acciones de cuenta a sí mismo", async () => {
  const c = await newContainer();
  const admin = await loginAs(c, "admin");
  await assert.rejects(c.services.access.forcePasswordChange(admin, admin.user.id), ForbiddenError);
  await assert.rejects(c.services.access.revokeUserSessions(admin, admin.user.id), ForbiddenError);
  await assert.rejects(c.services.access.revokeSession(admin, admin.session.keyHash), ValidationError);
});

test("bloqueos: aparecen con la cuenta enmascarada y el desbloqueo devuelve el acceso", async () => {
  const c = await newContainer();
  const attacker = anonCtx("10.20.30.40");
  for (let i = 0; i < 5; i++) await c.services.auth.login(attacker, { email: DEMO.cliente[0], password: `mala-${i}` }).catch(() => {});
  await assert.rejects(c.services.auth.login(attacker, { email: DEMO.cliente[0], password: DEMO.cliente[1] }), TooManyRequestsError);

  const lockout = (await c.services.access.listLockouts()).find((l) => l.locked);
  assert.match(lockout.label, /^c\*\*\*@tienda\.test · 10\.20\.30\.0$/);
  assert.equal((await c.services.access.listFailedAttempts()).length, 5);

  const admin = await loginAs(c, "admin");
  await c.services.access.unlock(admin, { bucket: lockout.bucket, key: lockout.key, label: lockout.label });
  await assert.doesNotReject(c.services.auth.login(attacker, { email: DEMO.cliente[0], password: DEMO.cliente[1] }));
});

test("sesiones activas: el administrador ve y cierra la sesión de otro usuario", async () => {
  const c = await newContainer();
  const admin = await loginAs(c, "admin");
  const operador = await loginAs(c, "operador");
  const listed = await c.services.access.listSessions(admin);
  assert.ok(listed.find((s) => s.current && s.user.id === admin.user.id));
  const target = listed.find((s) => s.user.id === operador.user.id);
  assert.equal("rtChannel" in target, false, "el canal realtime privado no se expone");
  await c.services.access.revokeSession(admin, target.id);
  assert.equal(await c.services.sessions.resolve(operador.token), null);
});

test("política de acceso: cambios auditados y siempre dentro de rangos seguros", async () => {
  const c = await newContainer();
  const admin = await loginAs(c, "admin");
  await assert.rejects(c.services.access.updatePolicy(admin, { maxFailedLogins: 100 }), ValidationError);
  const updated = await c.services.access.updatePolicy(admin, { maxFailedLogins: 3, requireStaffMfa: true });
  assert.equal(updated.maxFailedLogins, 3);
  const { policy, limits } = await c.services.access.getPolicy();
  assert.equal(policy.requireStaffMfa, true);
  assert.equal(limits.maxFailedLogins.max, 10);
  const entry = (await c.services.audit.list()).find((e) => e.action === "access.policy_update");
  assert.deepEqual(entry.details.antes, { maxFailedLogins: 5, requireStaffMfa: false });
});

test("reiniciar MFA solo aplica a cuentas que lo tienen activo", async () => {
  const c = await newContainer();
  const admin = await loginAs(c, "admin");
  const [cliente] = await c.services.userAdmin.list({ role: "cliente" });
  await assert.rejects(c.services.access.resetMfa(admin, cliente.id), /no tiene MFA/);
});
