import { api } from "../../api.js";
import { date, ROLE_LABEL } from "../../format.js";
import { can } from "../../permissions.js";
import { useAuth } from "../../state.jsx";
import { useApi, useAction } from "../../hooks/useApi.js";
import { useLiveRefresh } from "../../realtime/RealtimeProvider.jsx";
import { ErrorAlert, Loading, ReadOnlyNote } from "./ui.jsx";

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

export default function Users() {
  const { user: me } = useAuth();
  const { data, error, load, setError } = useApi("/api/admin/users");
  useLiveRefresh("admin.users", load);
  const run = useAction(load, setError);
  const canManage = can(me, "users:manage");
  const update = (id, body) => run(() => api(`/api/admin/users/${id}`, { method: "PUT", body }));

  if (!data) return error ? <ErrorAlert error={error} /> : <Loading headers={["Usuario","Rol","MFA","Estado","Último acceso","Alta"]} label="Cargando usuarios…" />;
  return (
    <div className="panel scroll">
      <ErrorAlert error={error} />
      {canManage ? <p className="hint">Al cambiar el rol o desactivar una cuenta se revocan todas sus sesiones activas.</p> : <ReadOnlyNote />}
      <table className="table">
        <thead><tr><th>Usuario</th><th>Rol</th><th>MFA</th><th>Estado</th><th>Último acceso</th><th>Alta</th></tr></thead>
        <tbody>
          {data.users.map((u) => {
            const editable = canManage && u.id !== me.id;
            return (
              <tr key={u.id} className={u.active ? "" : "inactive"}>
                <td>{u.name}<br /><small className="muted">{u.email}</small></td>
                <td><RoleCell user={u} editable={editable} onChange={(body) => update(u.id, body)} /></td>
                <td>{u.mfaEnabled ? "✓" : "—"}</td>
                <td><StatusCell user={u} editable={editable} onChange={(body) => update(u.id, body)} /></td>
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
