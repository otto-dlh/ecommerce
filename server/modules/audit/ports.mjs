// Puertos del modulo de auditoria: bitacora append-only.

/**
 * @typedef {object} AuditEntry
 * @property {string} id
 * @property {string} at
 * @property {string} action
 * @property {"ok"|"failure"|"denied"|"rejected"} outcome
 * @property {{ id: string, role: string, email: string }|null} actor   correo enmascarado
 * @property {string|null} ip                                            IP enmascarada
 * @property {string|null} target
 * @property {object|null} details
 * @property {string} mac                                                HMAC-SHA256 del registro
 */

/**
 * @typedef {object} AuditRepository
 * @property {(entry: AuditEntry) => Promise<void>} append       solo agrega; nunca modifica ni borra
 * @property {(filter?: { limit?: number, since?: string }) => Promise<AuditEntry[]>} list   recientes primero
 */

export const AUDIT_PORTS = Object.freeze({
  audit: ["append", "list"],
});
