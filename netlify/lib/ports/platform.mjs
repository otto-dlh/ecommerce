// Puertos de plataforma: bitacora, archivos y eventos en tiempo real.

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

/**
 * @typedef {object} FileStorage
 * @property {(key: string, bytes: Uint8Array, contentType: string) => Promise<{ key: string, url: string }>} put
 * @property {(key: string) => Promise<void>} remove
 */

/**
 * @typedef {object} RealtimePublisher
 * @property {(channels: string[], event: string, payload: object) => Promise<void>} publish
 */

export const PLATFORM_PORTS = Object.freeze({
  audit: ["append", "list"],
  files: ["put", "remove"],
  realtime: ["publish"],
});
