// Politica de acceso configurable desde el panel, siempre dentro de rangos seguros
// (ASVS v5.0.0-6.3.1 limites de intentos, 7.3.1/7.3.2 expiracion de sesiones).
import { ValidationError } from "../../../shared/domain/errors.mjs";
import * as v from "../../../shared/domain/validate.mjs";

/** Rango permitido y valor por defecto de cada parametro numerico. */
export const POLICY_LIMITS = Object.freeze({
  sessionIdleMinutes: { min: 5, max: 120, default: 30, label: "Cierre por inactividad (minutos)" },
  sessionMaxHours: { min: 1, max: 24, default: 8, label: "Duración máxima de la sesión (horas)" },
  maxFailedLogins: { min: 3, max: 10, default: 5, label: "Intentos fallidos antes del bloqueo" },
  lockoutMinutes: { min: 5, max: 1440, default: 15, label: "Duración del bloqueo (minutos)" },
});

export const DEFAULT_POLICY = Object.freeze({
  ...Object.fromEntries(Object.entries(POLICY_LIMITS).map(([key, limit]) => [key, limit.default])),
  requireStaffMfa: false,
});

/** Intentos fallidos tolerados para una cuenta sumando todas las IP (credential stuffing distribuido). */
export const accountWideFailureLimit = (policy) => policy.maxFailedLogins * 4;

/** Intentos totales (exitosos o no) por IP dentro de la ventana de bloqueo. */
export const IP_LOGIN_ATTEMPTS_PER_WINDOW = 30;

export const sessionIdleMs = (policy) => policy.sessionIdleMinutes * 60 * 1000;
export const sessionMaxMs = (policy) => policy.sessionMaxHours * 60 * 60 * 1000;
export const lockoutWindowSec = (policy) => policy.lockoutMinutes * 60;

/** Cambios de politica enviados por un administrador (todos opcionales, al menos uno). */
export function parsePolicyChanges(body) {
  const changes = {};
  for (const [key, limit] of Object.entries(POLICY_LIMITS)) {
    if (body[key] !== undefined) changes[key] = v.int(body[key], limit.label, limit);
  }
  if (body.requireStaffMfa !== undefined) changes.requireStaffMfa = v.bool(body.requireStaffMfa, "MFA obligatoria para el personal");
  if (Object.keys(changes).length === 0) throw new ValidationError("No hay cambios que aplicar");
  return changes;
}
