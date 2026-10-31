// Contexto de la solicitud que la capa HTTP entrega a los casos de uso.
import { maskEmail } from "./domain/masking.mjs";

/**
 * @typedef {object} RequestContext
 * @property {import("../modules/identity/ports.mjs").User|null} user
 * @property {import("../modules/identity/ports.mjs").Session|null} session
 * @property {string} ip
 * @property {string} [userAgent]
 */

/** Actor para la bitacora: identidad minima con el correo enmascarado. */
export const actorOf = (ctx) => (ctx?.user ? { id: ctx.user.id, role: ctx.user.role, email: maskEmail(ctx.user.email) } : null);

/** Contexto para procesos del sistema (siembra, expiraciones, tareas programadas). */
export const systemContext = (name = "sistema") => ({ user: null, session: null, ip: "0.0.0.0", userAgent: name });
