// Permisos en la interfaz: SOLO sirven para mostrar u ocultar opciones.
// La autorizacion real la decide la API en cada endpoint con la misma matriz (domain/permissions.mjs),
// y el servidor envia la lista de permisos del usuario en /api/auth/me.

export const can = (user, perm) => Boolean(user?.permissions?.includes(perm));

/** Personal = cualquier cuenta con al menos un permiso del panel. */
export const isStaff = (user) => Boolean(user?.permissions?.length);
