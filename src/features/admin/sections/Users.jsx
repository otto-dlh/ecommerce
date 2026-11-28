import { useState } from "react";
import { accessApi, usersApi } from "../../../shared/api/index.js";
import { date, ROLE_LABEL } from "../../../shared/lib/format.js";
import { can } from "../../../shared/lib/permissions.js";
import { useAuth } from "../../auth/index.js";
import { useApi, useAction } from "../../../shared/hooks/useApi.js";
import { useLiveRefresh } from "../../../shared/realtime/RealtimeProvider.jsx";
import { ErrorAlert, Loading, ReadOnlyNote } from "../ui.jsx";
import { TemporaryPassword } from "../TemporaryPassword.jsx";

function RoleCell({ user, editable, onChange }) {
  if (!editable) return <>{user.roleLabel}</>;
  return (
    <select value={user.role} onChange={(e) => onChange({ role: e.target.value })} aria-label={`Rol de ${user.email}`}>
      {Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>
  );
}

function StatusCell({ user, editable, onChange }) {
  if (!editable) return <>{user.active ? "Activo" : "Inactivo"}</>;
  return (
    <button className="btn ghost sm" onClick={() => onChange({ active: !user.active })}>
      {user.active ? "Activo · desactivar" : "Inactivo · activar"}
    </button>
  );
}

/**
 * Restablecimiento de contrasena por el administrador: el servidor genera una temporal de un solo
 * uso, marca la cuenta para que la cambie al entrar y cierra sus sesiones. Es la misma accion de
 * «Accesos → Cuentas» (POST /api/admin/access/users/:id/force-password).
 */
function PasswordCell({ user, run, onTemporary }) {
  const reset = async () => {
    if (!confirm(`¿Restablecer la contraseña de ${user.email}? Se cerrarán todas sus sesiones.`)) return;
    const result = await run(() => accessApi.forcePassword(user.id));
    if (result) onTemporary({ account: user.email, password: result.temporaryPassword });
  };
  return (
    <div className="row">
      {user.mustChangePassword && <span className="status warn">Cambio pendiente</span>}
      <button className="btn ghost sm" onClick={reset}>Restablecer contraseña</button>
    </div>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const { data, error, load, setError } = useApi(usersApi.list);
  useLiveRefresh(["admin.users", "admin.access"], load);
  const run = useAction(load, setError);
  const canManage = can(me, "users:manage");
  // Restablecer la contrasena es una accion de acceso, con su propio permiso
  const canResetPassword = can(me, "access:manage");
  const [temporary, setTemporary] = useState(null);
  const update = (id, body) => run(() => usersApi.update(id, body));

  const headers = ["Usuario", "Rol", "MFA", "Estado", ...(canResetPassword ? ["Contraseña"] : []), "Último acceso", "Alta"];
  if (!data) return error ? <ErrorAlert error={error} /> : <Loading headers={headers} label="Cargando usuarios…" />;
  return (
    <div className="panel scroll">
      <ErrorAlert error={error} />
      {temporary && <TemporaryPassword {...temporary} onClose={() => setTemporary(null)} />}
      {canManage ? (
        <p className="hint">
          Al cambiar el rol o desactivar una cuenta se revocan todas sus sesiones activas.
          {canResetPassword && " Restablecer la contraseña genera una temporal de un solo uso, que se muestra aquí una sola vez."}
        </p>
      ) : <ReadOnlyNote />}
      <table className="table">
        <thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {data.users.map((u) => {
            const editable = canManage && u.id !== me.id;
            return (
              <tr key={u.id} className={u.active ? "" : "inactive"}>
                <td>{u.name}<br /><small className="muted">{u.email}</small></td>
                <td><RoleCell user={u} editable={editable} onChange={(body) => update(u.id, body)} /></td>
                <td>{u.mfaEnabled ? "✓" : "—"}</td>
                <td><StatusCell user={u} editable={editable} onChange={(body) => update(u.id, body)} /></td>
                {canResetPassword && <td>{u.id === me.id ? <small className="muted">Tu cuenta</small> : <PasswordCell user={u} run={run} onTemporary={setTemporary} />}</td>}
                <td><small>{u.lastLoginAt ? date(u.lastLoginAt) : "—"}</small></td>
                <td><small>{date(u.createdAt)}</small></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
