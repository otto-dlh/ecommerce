// Proyecciones y reglas de cuentas de usuario.
import { ForbiddenError, ValidationError } from "../../../shared/domain/errors.mjs";
import { ROLES, ROLE_LABELS, permissionsOf, isStaff } from "./permissions.mjs";
import * as v from "../../../shared/domain/validate.mjs";

export const GENERIC_LOGIN_ERROR = "Correo o contraseña incorrectos";

/** Lo que el propio usuario ve de su cuenta (incluye sus permisos para adaptar la interfaz). */
export const selfView = (user) =>
  user && {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    roleLabel: ROLE_LABELS[user.role],
    mfaEnabled: Boolean(user.mfa?.enabled),
    mustChangePassword: Boolean(user.mustChangePassword),
    permissions: permissionsOf(user.role),
  };

/** Lo que el personal autorizado ve de una cuenta en el panel. */
export const adminUserView = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  roleLabel: ROLE_LABELS[user.role],
  active: user.active,
  mfaEnabled: Boolean(user.mfa?.enabled),
  mustChangePassword: Boolean(user.mustChangePassword),
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt ?? null,
});

/** Primer nombre para mostrar en resenas publicas (no expone el nombre completo). */
export const publicDisplayName = (user) => user.name.split(" ")[0];

/** Cambios de rol/estado enviados por un administrador. */
export function parseUserChanges(body) {
  const changes = {};
  if (body.role !== undefined) changes.role = v.oneOf(body.role, "rol", ROLES);
  if (body.active !== undefined) changes.active = v.bool(body.active, "activo");
  if (Object.keys(changes).length === 0) throw new ValidationError("No hay cambios que aplicar");
  return changes;
}

/** Nadie modifica su propio rol o estado (evita auto-escalada y bloqueos accidentales). */
export function assertNotSelf(actor, targetId) {
  if (actor.id === targetId) throw new ForbiddenError("No puedes modificar tu propia cuenta desde el panel");
}

/** Siempre debe quedar al menos un administrador activo. */
export function assertKeepsAnAdmin({ target, changes, activeAdmins }) {
  const losesAdmin = target.role === "admin" && target.active && (changes.role && changes.role !== "admin" || changes.active === false);
  if (losesAdmin && activeAdmins <= 1) throw new ForbiddenError("Debe quedar al menos un administrador activo");
}

/** La politica puede exigir MFA al personal antes de usar el panel. */
export const needsMfaForPanel = (user, policy) => policy.requireStaffMfa && isStaff(user) && !user.mfa?.enabled;
