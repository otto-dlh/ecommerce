import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePolicyChanges, DEFAULT_POLICY } from "../../../server/modules/identity/domain/accessPolicy.mjs";
import { assertKeepsAnAdmin, selfView } from "../../../server/modules/identity/domain/users.mjs";
import { ValidationError, ForbiddenError } from "../../../server/shared/domain/errors.mjs";

test("politica de acceso: solo valores dentro de rangos seguros", () => {
  assert.deepEqual(parsePolicyChanges({ maxFailedLogins: 4 }), { maxFailedLogins: 4 });
  assert.throws(() => parsePolicyChanges({ maxFailedLogins: 50 }), ValidationError);
  assert.throws(() => parsePolicyChanges({ sessionIdleMinutes: 1 }), ValidationError);
  assert.throws(() => parsePolicyChanges({}), /No hay cambios/);
  assert.equal(DEFAULT_POLICY.maxFailedLogins, 5);
});

test("siempre queda al menos un administrador activo", () => {
  const admin = { role: "admin", active: true };
  assert.throws(() => assertKeepsAnAdmin({ target: admin, changes: { role: "cliente" }, activeAdmins: 1 }), ForbiddenError);
  assert.throws(() => assertKeepsAnAdmin({ target: admin, changes: { active: false }, activeAdmins: 1 }), ForbiddenError);
  assert.doesNotThrow(() => assertKeepsAnAdmin({ target: admin, changes: { role: "cliente" }, activeAdmins: 2 }));
});

test("la vista propia expone permisos y nunca el hash de la contrasena", () => {
  const view = selfView({ id: "u1", email: "a@b.co", name: "A", role: "auditor", passwordHash: "scrypt$...", mfa: { enabled: false, secret: "x" } });
  assert.ok(view.permissions.includes("audit:read"));
  assert.equal("passwordHash" in view, false);
  assert.equal(JSON.stringify(view).includes("scrypt"), false);
});
