// Puertos de infraestructura compartida: limites de frecuencia y almacenamiento de archivos.

/**
 * @typedef {object} RateLimitWindow
 * @property {string} key
 * @property {number} count
 * @property {string} resetAt
 * @property {string|null} label   dato enmascarado para el panel (p. ej. correo)
 */

/**
 * @typedef {object} RateLimitStore
 * @property {(bucket: string, key: string, opts: { limit: number, windowSec: number, label?: string }) => Promise<{ allowed: boolean, count: number, retryAfterSec: number }>} hit
 *           atomico: cuenta la solicitud y decide si se permite
 * @property {(bucket: string, key: string) => Promise<RateLimitWindow|null>} peek
 * @property {(bucket: string, key: string, opts: { windowSec: number, label?: string }) => Promise<number>} increment
 * @property {(bucket: string, key: string) => Promise<void>} clear
 * @property {(bucket: string, opts?: { minCount?: number }) => Promise<RateLimitWindow[]>} list   solo ventanas vigentes
 */

/**
 * @typedef {object} FileStorage
 * @property {(key: string, bytes: Uint8Array, contentType: string) => Promise<{ key: string, url: string }>} put
 * @property {(key: string) => Promise<void>} remove
 */

export const SHARED_PORTS = Object.freeze({
  rateLimits: ["hit", "peek", "increment", "clear", "list"],
  files: ["put", "remove"],
});
