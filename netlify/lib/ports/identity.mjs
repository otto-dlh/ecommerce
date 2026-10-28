// Puertos de identidad y acceso. Contratos que cualquier adaptador de datos debe cumplir.

/**
 * @typedef {object} User
 * @property {string} id
 * @property {string} email                minusculas
 * @property {string} name
 * @property {"admin"|"operador"|"auditor"|"cliente"} role
 * @property {boolean} active
 * @property {string} passwordHash         formato scrypt$N$r$p$sal$hash
 * @property {{ enabled: boolean, secret?: string|null, pendingSecret?: string|null, lastCounter?: number|null }} mfa
 *           secretos cifrados con keyring.encrypt("mfa", ...)
 * @property {boolean} mustChangePassword
 * @property {string} createdAt            ISO 8601
 * @property {string|null} lastLoginAt
 */

/**
 * @typedef {object} UserRepository
 * @property {(id: string) => Promise<User|null>} findById
 * @property {(email: string) => Promise<User|null>} findByEmail
 * @property {(user: User) => Promise<User>} create                 ConflictError si el correo ya existe
 * @property {(id: string, changes: Partial<User>) => Promise<User|null>} update
 * @property {(filter?: { role?: string, search?: string }) => Promise<User[]>} list
 * @property {(role: string) => Promise<number>} countActiveByRole
 * @property {(id: string, counter: number) => Promise<boolean>} advanceMfaCounter
 *           atomico: solo avanza si counter > lastCounter (anti-replay TOTP)
 */

/**
 * @typedef {object} Session
 * @property {string} keyHash      SHA-256 del token; el token nunca se guarda
 * @property {string} userId
 * @property {string} role         rol al crear la sesion (cambiar el rol revoca las sesiones)
 * @property {string} csrf
 * @property {string} rtChannel    id aleatorio del canal realtime privado
 * @property {string} createdAt
 * @property {string} lastSeen
 * @property {string|null} ipMasked
 * @property {string} userAgent    resumido (navegador · sistema)
 */

/**
 * @typedef {object} SessionRepository
 * @property {(session: Session) => Promise<Session>} create
 * @property {(keyHash: string) => Promise<Session|null>} findByKeyHash
 * @property {(keyHash: string, lastSeen: string) => Promise<void>} touch
 * @property {(keyHash: string) => Promise<boolean>} delete
 * @property {(userId: string, options?: { exceptKeyHash?: string }) => Promise<number>} deleteByUser
 * @property {(filter?: { userId?: string }) => Promise<Session[]>} list
 * @property {(filter: { userIds?: string[], roles?: string[], excludeUserIds?: string[] }) => Promise<string[]>} listChannels
 * @property {(cutoff: { idleBefore: string, createdBefore: string }) => Promise<number>} deleteExpired
 */

/**
 * @typedef {object} MfaChallengeRepository
 * @property {(challenge: { tokenHash: string, userId: string, expiresAt: string }) => Promise<void>} create
 * @property {(tokenHash: string) => Promise<{ userId: string, expiresAt: string, attempts: number }|null>} consumeAttempt
 *           atomico: devuelve el estado previo y suma un intento
 * @property {(tokenHash: string) => Promise<void>} delete
 */

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
 * @typedef {object} PolicyRepository
 * @property {() => Promise<import("../domain/accessPolicy.mjs").DEFAULT_POLICY>} get   valores por defecto si no hay fila
 * @property {(changes: object) => Promise<object>} update
 */

export const IDENTITY_PORTS = Object.freeze({
  users: ["findById", "findByEmail", "create", "update", "list", "countActiveByRole", "advanceMfaCounter"],
  sessions: ["create", "findByKeyHash", "touch", "delete", "deleteByUser", "list", "listChannels", "deleteExpired"],
  mfaChallenges: ["create", "consumeAttempt", "delete"],
  rateLimits: ["hit", "peek", "increment", "clear", "list"],
  policy: ["get", "update"],
});
