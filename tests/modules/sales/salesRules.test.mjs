import { test } from "node:test";
import assert from "node:assert/strict";
import { canTransition, statusesLeadingTo, isPaymentOverdue } from "../../../server/modules/sales/domain/orderStateMachine.mjs";
import { parseCouponInput } from "../../../server/modules/sales/domain/coupons.mjs";
import { paymentMismatch, parseSignatureHeader } from "../../../server/modules/sales/domain/payments.mjs";

test("maquina de estados: solo transiciones permitidas", () => {
  assert.equal(canTransition("pendiente_pago", "pagado"), false); // solo el webhook, por updateStatus directo
  assert.equal(canTransition("pagado", "preparando"), true);
  assert.equal(canTransition("entregado", "cancelado"), false);
  assert.deepEqual(statusesLeadingTo("cancelado").sort(), ["pagado", "pendiente_pago"]);
  assert.equal(isPaymentOverdue({ status: "pendiente_pago", expiresAt: "2000-01-01T00:00:00Z" }), true);
  assert.equal(isPaymentOverdue({ status: "pagado", expiresAt: "2000-01-01T00:00:00Z" }), false);
});

test("cupones: coherencia de tipo, valor y fechas", () => {
  const base = { code: "nuevo10", label: "Nuevo", type: "percent", value: 10, minSubtotal: 0, oncePerUser: false, active: true };
  assert.equal(parseCouponInput(base).code, "NUEVO10");
  assert.throws(() => parseCouponInput({ ...base, value: 150 }), /entre 1 y 100/);
  assert.throws(() => parseCouponInput({ ...base, startsAt: "2026-02-01", endsAt: "2026-01-01" }), /posterior/);
});

test("pagos: firma y coincidencia de monto", () => {
  assert.deepEqual(parseSignatureHeader("t=123,v1=abc"), { timestamp: 123, signature: "abc" });
  assert.deepEqual(parseSignatureHeader("basura"), { timestamp: null, signature: null });
  const order = { status: "pendiente_pago", total: 1000 };
  assert.equal(paymentMismatch(order, { amount: 1000, currency: "GTQ" }), null);
  assert.equal(paymentMismatch(order, { amount: 1, currency: "GTQ" }), "monto no coincide");
  assert.equal(paymentMismatch({ ...order, status: "pagado" }, { amount: 1000, currency: "GTQ" }), "estado pagado");
});
