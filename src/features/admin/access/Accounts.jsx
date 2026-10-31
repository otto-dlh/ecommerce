import { useState } from "react";
import { accessApi, usersApi } from "../../../shared/api/index.js";
import { date } from "../../../shared/lib/format.js";
import { useAuth } from "../../auth/index.js";
import { useApi, useAction } from "../../../shared/hooks/useApi.js";
import { useLiveRefresh } from "../../../shared/realtime/RealtimeProvider.jsx";
import { ErrorAlert, Loading } from "../ui.jsx";
import "./accounts.css";

/** Muestra la contraseña temporal una sola vez, con opción de copiarla. */
function TemporaryPassword({ account, password, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(password);
    setCopied(true);
  };
  return (
    <div className="alert ok temp-password" role="status">
      <p>Contraseña temporal de <b>{account}</b> (se muestra solo esta vez; compártela por un canal seguro):</p>
      <div className="row">
        <code>{password}</code>
        <button className="btn sm" onClick={copy}>{copied ? "✓ Copiada" : "Copiar"}</button>
        <button className="btn ghost sm" onClick={onClose}>Listo</button>
      </div>
      <p className="muted small">Al ingresar con ella, el sistema le pedirá elegir una contraseña nueva.</p>
    </div>
  );
}

function AccountActions({ account, run, onTemporary }) {
  const forcePassword = async () => {
    if (!confirm(`¿Restablecer la contraseña de ${account.email}? Se cerrarán todas sus sesiones.`)) return;
    const result = await run(() => accessApi.forcePassword(account.id));
    if (result) onTemporary({ account: account.email, password: result.temporaryPassword });
  };
  const resetMfa = () => confirm(`¿Reiniciar el MFA de ${account.email}? Deberá configurarlo de nuevo.`) && run(() => accessApi.resetMfa(account.id));
  const closeSessions = () => run(() => accessApi.revokeUserSessions(account.id));
  return (
    <div className="row">
      <button className="btn ghost sm" onClick={forcePassword}>Restablecer contraseña</button>
      {account.mfaEnabled && <button className="btn ghost sm" onClick={resetMfa}>Reiniciar MFA</button>}
      <button className="btn ghost sm" onClick={closeSessions}>Cerrar sesiones</button>
    </div>
  );
}

/** Estado de acceso de cada cuenta y acciones de recuperación. */
export default function Accounts({ canManage }) {
  const { user: me } = useAuth();
  const { data, error, load, setError } = useApi(usersApi.list);
  const run = useAction(load, setError);
  useLiveRefresh(["admin.users", "admin.access"], load);
  const [temporary, setTemporary] = useState(null);

  if (!data) return error ? <ErrorAlert error={error} /> : <Loading headers={["Cuenta","Rol","MFA","Contraseña","Último acceso"]} label="Cargando cuentas…" />;
  return (
    <>
      <ErrorAlert error={error} />
      {temporary && <TemporaryPassword {...temporary} onClose={() => setTemporary(null)} />}
      <p className="hint">Sin correo de recuperación, el administrador restablece la contraseña con una temporal de un solo uso. Activar o desactivar cuentas y cambiar roles se hace en «Usuarios».</p>
      <div className="panel scroll">
        <table className="table">
          <thead><tr><th>Cuenta</th><th>Rol</th><th>MFA</th><th>Contraseña</th><th>Último acceso</th>{canManage && <th>Acciones</th>}</tr></thead>
          <tbody>
            {data.users.map((u) => (
              <tr key={u.id} className={u.active ? "" : "inactive"}>
                <td>{u.name}<br /><small className="muted">{u.email}{!u.active && " · desactivada"}</small></td>
                <td>{u.roleLabel}</td>
                <td>{u.mfaEnabled ? <span className="status ok">Activo</span> : <span className="status muted">No</span>}</td>
                <td>{u.mustChangePassword ? <span className="status warn">Cambio pendiente</span> : <small className="muted">Vigente</small>}</td>
                <td><small>{u.lastLoginAt ? date(u.lastLoginAt) : "—"}</small></td>
                {canManage && <td>{u.id !== me.id && <AccountActions account={u} run={run} onTemporary={setTemporary} />}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
