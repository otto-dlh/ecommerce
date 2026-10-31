import { test } from "node:test";
import assert from "node:assert/strict";
import { auditAlerts, orderAlerts, reviewAlerts, sessionAlerts, stockAlerts, SEVERITY } from "../../../server/modules/notifications/domain/alerts.mjs";
import { createThrottle } from "../../../server/modules/notifications/application/alertService.mjs";

const kinds = (alerts) => alerts.map((a) => a.kind);
const entry = (overrides) => ({ id: "e1", action: "", outcome: "ok", actor: { id: "u-actor", role: "admin", email: "a***@x.test" }, ip: "10.0.0.0", target: null, details: null, ...overrides });

test("pedidos: el pago avisa al cliente y a quien prepara; nunca al autor del cambio", () => {
  const paid = orderAlerts({ orderId: "o1", userId: "u1", status: "pagado", from: "pendiente_pago", total: 9900, actorId: null });
  assert.deepEqual(kinds(paid), ["order.status", "order.paid"]);
  assert.deepEqual(paid[0].to, { userIds: ["u1"] });
  assert.deepEqual(paid[1].to, { perm: "orders:manage" });

  const preparing = orderAlerts({ orderId: "o1", userId: "u1", status: "preparando", from: "pagado", actorId: "u-operador" });
  assert.deepEqual(kinds(preparing), ["order.status"], "el personal no recibe alerta de su propio avance");

  const selfCancel = orderAlerts({ orderId: "o1", userId: "u1", status: "cancelado", from: "pendiente_pago", actorId: "u1" });
  assert.deepEqual(selfCancel, [], "quien cancela su propio pedido ya lo sabe");

  const expired = orderAlerts({ orderId: "o1", userId: "u1", status: "cancelado", from: "pendiente_pago", actorId: "sistema:expiracion" });
  assert.deepEqual(kinds(expired), ["order.status"]);
  assert.equal(expired[0].severity, SEVERITY.WARNING);
});

test("pedidos: anular un pedido pagado avisa al resto del personal para detener la preparación", () => {
  const alerts = orderAlerts({ orderId: "o1", userId: "u1", status: "cancelado", from: "pagado", actorId: "u-admin" });
  assert.deepEqual(kinds(alerts), ["order.status", "order.cancelled"]);
  assert.deepEqual(alerts[1].to, { perm: "orders:manage", excludeUserIds: ["u-admin"] });
});

test("inventario: solo productos activos con stock bajo o agotado", () => {
  const alerts = stockAlerts([
    { id: "a", name: "A", stock: 0 },
    { id: "b", name: "B", stock: 3 },
    { id: "c", name: "C", stock: 4 },
    { id: "d", name: "D", stock: 0, active: false },
  ], { actorId: "u-op" });
  assert.deepEqual(alerts.map((a) => [a.kind, a.severity, a.data.productId]), [["stock.out", SEVERITY.CRITICAL, "a"], ["stock.low", SEVERITY.WARNING, "b"]]);
  assert.deepEqual(alerts[0].to, { perm: "inventory:write", excludeUserIds: ["u-op"] });
  assert.notEqual(alerts[0].key, stockAlerts([{ id: "a", name: "A", stock: 1 }])[0].key, "cada nivel de stock es una alerta distinta");
});

test("reseñas: las de 1–2 estrellas se destacan y el autor no se avisa a sí mismo", () => {
  const [low] = reviewAlerts({ reviewId: "r1", productId: "p", productName: "P", rating: 1, authorId: "u1" });
  const [good] = reviewAlerts({ reviewId: "r2", productId: "p", productName: "P", rating: 5 });
  assert.equal(low.severity, SEVERITY.WARNING);
  assert.equal(good.severity, SEVERITY.INFO);
  assert.deepEqual(low.to, { perm: "reviews:moderate", excludeUserIds: ["u1"] });
});

test("cuenta: un inicio de sesión nuevo avisa a las otras sesiones, no a la nueva", () => {
  const [alert] = sessionAlerts({ userId: "u1", rtChannel: "nuevo", device: "Chrome · Windows", ip: "10.0.0.0" });
  assert.equal(alert.kind, "account.new_login");
  assert.deepEqual(alert.to, { userIds: ["u1"], excludeRtChannels: ["nuevo"] });
});

test("bitácora: incidentes de seguridad para quien supervisa, sin avisar a su autor", () => {
  const [denied] = auditAlerts(entry({ action: "authz.denied", outcome: "denied", actor: { id: "u-aud", role: "auditor", email: "a***@x" } }));
  assert.equal(denied.kind, "security.authz");
  assert.deepEqual(denied.to, { perm: "audit:read", excludeUserIds: ["u-aud"] });

  assert.equal(auditAlerts(entry({ action: "payment.webhook", outcome: "rejected", actor: null }))[0].severity, SEVERITY.CRITICAL);
  assert.deepEqual(auditAlerts(entry({ action: "payment.webhook" })), [], "un pago válido no es un incidente");
  assert.deepEqual(auditAlerts(entry({ action: "ratelimit.block", outcome: "denied", details: { bucket: "login-fail-acct" } })), [], "lo resume la alerta de bloqueo");
  assert.equal(auditAlerts(entry({ action: "ratelimit.block", outcome: "denied", details: { bucket: "global" } }))[0].kind, "security.ratelimit");
  assert.deepEqual(auditAlerts(entry({ action: "auth.login" })), [], "un login normal no es alerta");
});

test("bitácora: cambios privilegiados al auditor y avisos al dueño de la cuenta", () => {
  assert.deepEqual(kinds(auditAlerts(entry({ action: "user.update", target: "user:u2" }))), ["admin.change"]);

  const lockout = auditAlerts(entry({ action: "auth.lockout", outcome: "denied", actor: null, target: "user:u2", details: { cuenta: "c***@x", minutos: 15 } }));
  assert.deepEqual(kinds(lockout), ["security.lockout", "account.locked"]);
  assert.equal(lockout[0].severity, SEVERITY.CRITICAL);
  assert.deepEqual(lockout[1].to, { userIds: ["u2"], excludeRtChannels: [] });

  const mfaOff = auditAlerts(entry({ action: "auth.mfa_disabled", actor: { id: "u3", role: "cliente", email: "c***@x" }, originRtChannel: "esta" }));
  assert.deepEqual(kinds(mfaOff), ["account.mfa_disabled"]);
  assert.deepEqual(mfaOff[0].to, { userIds: ["u3"], excludeRtChannels: ["esta"] }, "se avisa a las otras sesiones");
});

test("agrupación: una alerta por clave en cada ventana, contando solo las entregadas", () => {
  let now = 0;
  const throttle = createThrottle(30_000, () => now);
  assert.equal(throttle.isOpen("x"), true);
  assert.equal(throttle.isOpen("x"), true, "consultar no consume la ventana");
  throttle.mark("x");
  assert.equal(throttle.isOpen("x"), false);
  assert.equal(throttle.isOpen("y"), true);
  now = 30_000;
  assert.equal(throttle.isOpen("x"), true);
});
