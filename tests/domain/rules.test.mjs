import { test } from "node:test";
import assert from "node:assert/strict";
import { canTransition, statusesLeadingTo, isPaymentOverdue } from "../../netlify/lib/domain/orderStateMachine.mjs";
import { parsePolicyChanges, DEFAULT_POLICY } from "../../netlify/lib/domain/accessPolicy.mjs";
import { parseCouponInput } from "../../netlify/lib/domain/coupons.mjs";
import { assertKeepsAnAdmin, selfView } from "../../netlify/lib/domain/users.mjs";
import { paymentMismatch, parseSignatureHeader } from "../../netlify/lib/domain/payments.mjs";
import { maskIp, maskEmail } from "../../netlify/lib/domain/masking.mjs";
import { ValidationError, ForbiddenError } from "../../netlify/lib/domain/errors.mjs";

test("maquina de estados: solo transiciones permitidas", () => {
  assert.equal(canTransition("pendiente_pago", "pagado"), false); // solo el webhook, por updateStatus directo
  assert.equal(canTransition("pagado", "preparando"), true);
  assert.equal(canTransition("entregado", "cancelado"), false);
  assert.deepEqual(statusesLeadingTo("cancelado").sort(), ["pagado", "pendiente_pago"]);
  assert.equal(isPaymentOverdue({ status: "pendiente_pago", expiresAt: "2000-01-01T00:00:00Z" }), true);
  assert.equal(isPaymentOverdue({ status: "pagado", expiresAt: "2000-01-01T00:00:00Z" }), false);
});

test("politica de acceso: solo valores dentro de rangos seguros", () => {
  assert.deepEqual(parsePolicyChanges({ maxFailedLogins: 4 }), { maxFailedLogins: 4 });
  assert.throws(() => parsePolicyChanges({ maxFailedLogins: 50 }), ValidationError);
  assert.throws(() => parsePolicyChanges({ sessionIdleMinutes: 1 }), ValidationError);
  assert.throws(() => parsePolicyChanges({}), /No hay cambios/);
  assert.equal(DEFAULT_POLICY.maxFailedLogins, 5);
});

test("cupones: coherencia de tipo, valor y fechas", () => {
  const base = { code: "nuevo10", label: "Nuevo", type: "percent", value: 10, minSubtotal: 0, oncePerUser: false, active: true };
  assert.equal(parseCouponInput(base).code, "NUEVO10");
  assert.throws(() => parseCouponInput({ ...base, value: 150 }), /entre 1 y 100/);
  assert.throws(() => parseCouponInput({ ...base, startsAt: "2026-02-01", endsAt: "2026-01-01" }), /posterior/);
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

test("enmascarado de IP y correo para bitácoras y paneles", () => {
  assert.equal(maskIp("190.56.12.34"), "190.56.12.0");
  assert.equal(maskIp("::ffff:190.56.12.34"), "190.56.12.0");
  assert.equal(maskIp("::1"), "::1");
  assert.equal(maskIp("2001:db8:abcd:12:3456::7"), "2001:db8:abcd::");
  assert.equal(maskIp("2001:db8::1"), "2001:db8::");
  assert.equal(maskEmail("carla@tienda.test"), "c***@tienda.test");
});

test("pagos: firma y coincidencia de monto", () => {
  assert.deepEqual(parseSignatureHeader("t=123,v1=abc"), { timestamp: 123, signature: "abc" });
  assert.deepEqual(parseSignatureHeader("basura"), { timestamp: null, signature: null });
  const order = { status: "pendiente_pago", total: 1000 };
  assert.equal(paymentMismatch(order, { amount: 1000, currency: "GTQ" }), null);
  assert.equal(paymentMismatch(order, { amount: 1, currency: "GTQ" }), "monto no coincide");
  assert.equal(paymentMismatch({ ...order, status: "pagado" }, { amount: 1000, currency: "GTQ" }), "estado pagado");
});
