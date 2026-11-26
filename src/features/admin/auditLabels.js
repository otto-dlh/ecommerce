// Nombres legibles de los eventos de la bitacora (los registra application/auditService.mjs).
// Un evento puede tener un texto por resultado (ok / failure / denied / rejected).
const ACTION_LABELS = {
  "auth.login": { ok: "Inicio de sesión", failure: "Inicio de sesión fallido" },
  "auth.login.mfa_challenge": "Se solicitó el segundo factor",
  "auth.mfa": { failure: "Código MFA incorrecto" },
  "auth.register": { ok: "Cuenta registrada", denied: "Registro rechazado" },
  "auth.logout": "Cierre de sesión",
  "auth.logout_all": "Cierre de todas las sesiones",
  "auth.password_change": { ok: "Cambio de contraseña", failure: "Cambio de contraseña fallido" },
  "auth.mfa_enabled": "MFA activado",
  "auth.mfa_disabled": { ok: "MFA desactivado", failure: "Intento fallido de desactivar MFA" },
  "auth.lockout": "Cuenta bloqueada por intentos fallidos",
  "authz.denied": "Acceso denegado",
  "ratelimit.block": "Bloqueo por exceso de solicitudes",
  "csrf.origin_rejected": "Origen no permitido",
  "csrf.token_rejected": "Petición sin token CSRF",
  "order.created": "Pedido creado",
  "order.rejected": "Pedido rechazado (sin existencias)",
  "quote.tampered": "Importes enviados por el cliente (descartados)",
  "quote.rejected": "Cotización rechazada",
  "search.suspicious": "Búsqueda sospechosa",
  "order.status": "Cambio de estado de pedido",
  "payment.webhook": { ok: "Pago confirmado por la pasarela", rejected: "Aviso de pago rechazado" },
  "product.create": "Producto creado",
  "product.update": "Producto modificado",
  "product.image": "Imagen de producto actualizada",
  "stock.adjust": "Ajuste de inventario",
  "category.create": "Categoría creada",
  "category.update": "Categoría modificada",
  "coupon.create": "Cupón creado",
  "coupon.update": "Cupón modificado",
  "user.update": "Cambio de rol o estado de usuario",
  "customer.view": "Consulta de datos de un cliente",
  "review.hide": "Reseña ocultada",
  "review.restore": "Reseña restaurada",
  "access.session_revoked": "Sesión cerrada por un administrador",
  "access.unlock": "Cuenta desbloqueada",
  "access.force_password": "Cambio de contraseña obligatorio",
  "access.mfa_reset": "MFA reiniciado por un administrador",
  "access.policy_update": "Política de acceso modificada",
};

// Accion con la que el laboratorio de seguridad registra cada prueba ejecutada.
// Debe coincidir con LAB_ACTION de server/modules/lab/domain/labTests.mjs (lo verifica una prueba).
export const LAB_ACTION = "lab.attack";

const LAB_RESULT_LABEL = {
  bloqueado: "bloqueado",
  no_bloqueado: "NO BLOQUEADO",
  omitida: "no se ejecutó",
};

/**
 * El laboratorio no tiene un texto fijo: si las 17 pruebas dijeran lo mismo, habría que abrir el
 * detalle para saber cuál fue. El evento es la amenaza, la prueba y su resultado.
 */
function labEventLabel({ details }) {
  const prueba = details?.prueba ?? "prueba desconocida";
  const amenaza = details?.amenaza ? `${details.amenaza} · ` : "";
  const resultado = LAB_RESULT_LABEL[details?.resultado] ?? details?.resultado;
  return `${amenaza}${prueba}${resultado ? ` — ${resultado}` : ""}`;
}

export function eventLabel(entry) {
  if (entry.action === LAB_ACTION) return labEventLabel(entry);
  const label = ACTION_LABELS[entry.action];
  if (!label) return entry.action;
  return typeof label === "string" ? label : label[entry.outcome] ?? label.ok ?? entry.action;
}

export const isIncident = (entry) => entry.outcome !== "ok";

// [etiqueta, filtro, esAlarma?]: el tercer valor en false cuenta sin pintar alarma.
export const AUDIT_COUNTERS = [
  ["Incidentes", isIncident, false],
  ["Logins fallidos", (e) => e.action === "auth.login" && e.outcome === "failure"],
  ["Accesos denegados", (e) => e.action === "authz.denied"],
  ["Bloqueos por límite", (e) => e.action === "ratelimit.block"],
  ["CSRF bloqueados", (e) => e.action.startsWith("csrf.")],
  ["Webhooks rechazados", (e) => e.action === "payment.webhook" && e.outcome !== "ok"],
  ["Pruebas del laboratorio", (e) => e.action === LAB_ACTION, false],
];
