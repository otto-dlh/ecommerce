// Alertas en vivo: QUE hechos merecen avisar a una persona, con que severidad y A QUIEN.
// Reglas puras (sin E/S). La capa de aplicacion resuelve la audiencia a canales y publica.
// - Nunca se avisa a quien hizo la accion (ya lo sabe).
// - Los datos de cada alerta son minimos y ya enmascarados; el detalle se consulta en la API.
// - `key` agrupa repeticiones del mismo hecho (p. ej. un ataque) para no inundar a nadie.

export const SEVERITY = Object.freeze({ CRITICAL: "critical", WARNING: "warning", SUCCESS: "success", INFO: "info" });

/** Con esta cantidad o menos, un producto activo se considera con stock bajo. */
export const LOW_STOCK_THRESHOLD = 3;

/**
 * @typedef {{ userIds?: string[], perm?: string, excludeUserIds?: string[], excludeRtChannels?: string[] }} Audience
 * @typedef {{ kind: string, severity: string, key: string, data: object, to: Audience }} AlertDraft
 */

const alert = (kind, severity, data, to, key = kind) => ({ kind, severity, data, to, key });
const without = (...ids) => ids.filter(Boolean);

// ---- Pedidos ----

/** Estados que se le avisan al dueno del pedido (y con que severidad). */
const OWNER_STATUS_SEVERITY = Object.freeze({
  pagado: SEVERITY.SUCCESS,
  preparando: SEVERITY.INFO,
  enviado: SEVERITY.INFO,
  entregado: SEVERITY.SUCCESS,
  cancelado: SEVERITY.WARNING,
});
/** Un pedido cancelado desde estos estados ya estaba pagado: el personal debe detener su preparacion. */
const PAID_STATUSES = new Set(["pagado", "preparando", "enviado"]);

/**
 * @param {{ orderId: string, userId: string, status: string, from?: string, total?: number, actorId?: string|null }} change
 * @returns {AlertDraft[]}
 */
export function orderAlerts({ orderId, userId, status, from, total, actorId = null }) {
  const alerts = [];
  const ownerSeverity = OWNER_STATUS_SEVERITY[status];
  if (ownerSeverity && actorId !== userId) {
    alerts.push(alert("order.status", ownerSeverity, { orderId, status, from }, { userIds: [userId] }, `order.status:${orderId}:${status}`));
  }
  if (status === "pagado") {
    alerts.push(alert("order.paid", SEVERITY.SUCCESS, { orderId, total }, { perm: "orders:manage" }, `order.paid:${orderId}`));
  }
  if (status === "cancelado" && PAID_STATUSES.has(from)) {
    alerts.push(alert("order.cancelled", SEVERITY.WARNING, { orderId, from }, { perm: "orders:manage", excludeUserIds: without(actorId) }, `order.cancelled:${orderId}`));
  }
  return alerts;
}

// ---- Inventario ----

/**
 * Productos que quedaron agotados o con stock bajo despues de una salida de inventario.
 * @param {{ id: string, name: string, stock: number, active?: boolean }[]} products
 * @param {{ actorId?: string|null }} [options]
 * @returns {AlertDraft[]}
 */
export function stockAlerts(products, { actorId = null } = {}) {
  const to = { perm: "inventory:write", excludeUserIds: without(actorId) };
  return products
    .filter((p) => p.active !== false && p.stock <= LOW_STOCK_THRESHOLD)
    .map((p) => {
      const data = { productId: p.id, name: p.name, stock: p.stock };
      const key = `stock:${p.id}:${p.stock}`;
      return p.stock === 0 ? alert("stock.out", SEVERITY.CRITICAL, data, to, key) : alert("stock.low", SEVERITY.WARNING, data, to, key);
    });
}

// ---- Resenas ----

/** Las resenas de 1 o 2 estrellas se destacan: suelen requerir respuesta o moderacion. */
const LOW_RATING = 2;

/**
 * @param {{ reviewId: string, productId: string, productName: string, rating: number, authorId?: string }} review
 * @returns {AlertDraft[]}
 */
export function reviewAlerts({ reviewId, productId, productName, rating, authorId }) {
  const severity = rating <= LOW_RATING ? SEVERITY.WARNING : SEVERITY.INFO;
  return [alert("review.pending", severity, { reviewId, productId, productName, rating }, { perm: "reviews:moderate", excludeUserIds: without(authorId) }, `review:${reviewId}`)];
}

// ---- Cuenta propia (ASVS v5.0.0-6.3.5 y 6.3.7: avisar intentos sospechosos y cambios de autenticacion) ----

/**
 * Inicio de sesion nuevo: se avisa a las OTRAS sesiones abiertas de la misma cuenta.
 * @param {{ userId: string, rtChannel: string, device?: string, ip?: string }} session
 * @returns {AlertDraft[]}
 */
export function sessionAlerts({ userId, rtChannel, device, ip }) {
  // La clave distingue dispositivo e IP: un acceso desde otro lugar nunca queda agrupado con el anterior
  return [alert("account.new_login", SEVERITY.INFO, { device, ip }, { userIds: [userId], excludeRtChannels: [rtChannel] }, `account.new_login:${userId}:${device}:${ip}`)];
}

// ---- Bitacora: seguridad y cambios administrativos ----

/** Fallos de login por cuenta: ya los resume la alerta de bloqueo (una sola, al cruzar el umbral). */
const LOGIN_FAILURE_BUCKETS = new Set(["login-fail-acct", "login-fail-global"]);

/** Incidentes de seguridad para quien supervisa (administrador y auditor). */
const SECURITY_RULES = {
  "auth.lockout": (e) => ["security.lockout", SEVERITY.CRITICAL, `lockout:${e.target ?? e.details?.cuenta}`],
  "ratelimit.block": (e) => (LOGIN_FAILURE_BUCKETS.has(e.details?.bucket) ? null : ["security.ratelimit", SEVERITY.WARNING, `ratelimit:${e.details?.bucket}:${e.ip}`]),
  "authz.denied": (e) => ["security.authz", SEVERITY.WARNING, `authz:${e.actor?.id ?? e.ip}`],
  "csrf.origin_rejected": (e) => ["security.csrf", SEVERITY.WARNING, `csrf:${e.ip}`],
  "csrf.token_rejected": (e) => ["security.csrf", SEVERITY.WARNING, `csrf:${e.ip}`],
  "payment.webhook": (e) => (e.outcome === "ok" ? null : ["security.webhook", SEVERITY.CRITICAL, "webhook"]),
};

/** Acciones privilegiadas que el auditor debe conocer en cuanto ocurren. */
const ADMIN_ACTIONS = new Set([
  "user.update",
  "access.force_password",
  "access.mfa_reset",
  "access.session_revoked",
  "access.unlock",
  "access.policy_update",
  "customer.view",
]);

const userIdFromTarget = (target) => (typeof target === "string" && target.startsWith("user:") ? target.slice(5) : null);

/** Avisos al dueno de la cuenta afectada (a sus otras sesiones). */
const OWNER_RULES = {
  "auth.lockout": (e) => {
    const userId = userIdFromTarget(e.target);
    return userId && { kind: "account.locked", severity: SEVERITY.WARNING, userId, data: { minutes: e.details?.minutos, ip: e.ip } };
  },
  "auth.mfa_disabled": (e) => e.outcome === "ok" && e.actor && { kind: "account.mfa_disabled", severity: SEVERITY.WARNING, userId: e.actor.id, data: { ip: e.ip } },
};

/** Lo que la bitacora ya muestra a quien tiene `audit:read`: no expone nada nuevo. */
const auditData = (e) => ({ action: e.action, outcome: e.outcome, actor: e.actor && { role: e.actor.role, email: e.actor.email }, ip: e.ip, target: e.target, details: e.details });

/**
 * @param {{ id: string, action: string, outcome: string, actor: {id:string, role:string, email:string}|null,
 *           ip: string, target: string|null, details: object|null, originRtChannel?: string|null }} entry
 * @returns {AlertDraft[]}
 */
export function auditAlerts(entry) {
  const alerts = [];
  const supervisors = { perm: "audit:read", excludeUserIds: without(entry.actor?.id) };

  const security = SECURITY_RULES[entry.action]?.(entry);
  if (security) {
    const [kind, severity, key] = security;
    alerts.push(alert(kind, severity, auditData(entry), supervisors, key));
  } else if (ADMIN_ACTIONS.has(entry.action) && entry.outcome === "ok") {
    alerts.push(alert("admin.change", SEVERITY.INFO, auditData(entry), supervisors, `admin:${entry.id}`));
  }

  const owner = OWNER_RULES[entry.action]?.(entry);
  if (owner) {
    const to = { userIds: [owner.userId], excludeRtChannels: without(entry.originRtChannel) };
    alerts.push(alert(owner.kind, owner.severity, owner.data, to, `${owner.kind}:${owner.userId}`));
  }
  return alerts;
}
