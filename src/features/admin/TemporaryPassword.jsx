import { useState } from "react";
import "./temporary-password.css";

/**
 * Contrasena temporal recien generada por un administrador. El servidor la devuelve una sola vez
 * (no se guarda en claro ni se escribe en la bitacora), asi que esta es la unica oportunidad de
 * copiarla. La usan «Usuarios» y «Accesos → Cuentas».
 */
export function TemporaryPassword({ account, password, onClose }) {
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
