// Roles y permisos: unica fuente de verdad de la autorizacion (ASVS v5.0.0-8.2.1, T04).
// El backend decide con can(); el frontend recibe la lista de permisos solo para ocultar botones.

export const ROLES = Object.freeze(["admin", "operador", "auditor", "cliente"]);

export const ROLE_LABELS = Object.freeze({
  admin: "Administrador",
  operador: "Operador",
  auditor: "Auditor",
  cliente: "Cliente",
});

const ADMIN = "admin";
const OPERADOR = "operador";
const AUDITOR = "auditor";

/** Permiso → roles que lo tienen. El auditor solo recibe permisos de lectura. */
const PERMISSIONS = Object.freeze({
  "stats:read": [ADMIN, OPERADOR, AUDITOR],
  "catalog:write": [ADMIN],
  "inventory:read": [ADMIN, OPERADOR, AUDITOR],
  "inventory:write": [ADMIN, OPERADOR],
  "categories:read": [ADMIN, AUDITOR],
  "categories:write": [ADMIN],
  "coupons:read": [ADMIN, AUDITOR],
  "coupons:write": [ADMIN],
  "orders:read": [ADMIN, OPERADOR, AUDITOR],
  "orders:manage": [ADMIN, OPERADOR],
  "orders:cancel": [ADMIN],
  "reviews:moderate": [ADMIN, OPERADOR],
  "customers:read": [ADMIN, AUDITOR],
  "users:read": [ADMIN, AUDITOR],
  "users:manage": [ADMIN],
  "access:read": [ADMIN, AUDITOR],
  "access:manage": [ADMIN],
  "audit:read": [ADMIN, AUDITOR],
});

export const ALL_PERMISSIONS = Object.freeze(Object.keys(PERMISSIONS));

export const isKnownPermission = (perm) => Object.hasOwn(PERMISSIONS, perm);

/** El usuario debe existir, estar activo y tener un rol que incluya el permiso. */
export const can = (user, perm) => Boolean(user && user.active !== false && PERMISSIONS[perm]?.includes(user.role));

export const permissionsOf = (role) => ALL_PERMISSIONS.filter((perm) => PERMISSIONS[perm].includes(role));

/** Personal = cualquier rol con acceso al panel de administracion. */
export const isStaff = (user) => Boolean(user && user.role !== "cliente");

/** Roles que reciben un permiso (lo usa el notificador para decidir destinatarios). */
export const rolesWith = (perm) => [...(PERMISSIONS[perm] ?? [])];
