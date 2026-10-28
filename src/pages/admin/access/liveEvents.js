// Eventos que cambian lo que muestra la seccion "Accesos": cambios administrativos y
// registros de bitacora de inicio de sesion, bloqueos y acciones sobre cuentas.
export const ACCESS_EVENTS = ["admin.access", "audit.recorded"];

const ACCESS_ACTIONS = /^(auth|access|ratelimit)\./;

/** Los avisos "admin.access" siempre aplican; de la bitacora solo los de acceso. */
export const isAccessRelated = (payload) => !payload?.action || ACCESS_ACTIONS.test(payload.action);
