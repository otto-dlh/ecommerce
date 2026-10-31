import { useState } from "react";
import { mfaApi } from "../../shared/api/index.js";
import { QrCode } from "../../shared/ui/QrCode.jsx";
import { useAuth } from "../auth/index.js";
import "./account.css";

/** Verificacion en dos pasos (TOTP): configurar con QR, activar y desactivar. */
export function MfaSection() {
  const { user, refresh } = useAuth();
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const start = async () => {
    setMsg("");
    try { setSetup(await mfaApi.setup()); } catch (e) { setMsg(e.message); }
  };
  const enable = async (e) => {
    e.preventDefault();
    try {
      await mfaApi.enable(code);
      setSetup(null); setCode(""); setMsg("MFA activado. Se cerraron tus otras sesiones."); refresh();
    } catch (err) { setMsg(err.message); }
  };
  const disable = async (e) => {
    e.preventDefault();
    try {
      await mfaApi.disable(code, password);
      setCode(""); setPassword(""); setMsg("MFA desactivado."); refresh();
    } catch (err) { setMsg(err.message); }
  };

  return (
    <section className="panel">
      <h2>Verificación en dos pasos (TOTP)</h2>
      {user.role === "admin" && !user.mfaEnabled && <p className="alert warn">Recomendado para administradores (ASVS v5.0.0-6.3.3, T01).</p>}
      {user.mfaEnabled ? (
        <form className="form narrow" onSubmit={disable}>
          <p className="ok-text">✓ MFA activo en tu cuenta.</p>
          <label>Contraseña<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          <label>Código actual<input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} maxLength={6} required /></label>
          <button className="btn ghost">Desactivar MFA</button>
        </form>
      ) : setup ? (
        <form className="form narrow" onSubmit={enable}>
          <p>Escanea este código con Google Authenticator, Microsoft Authenticator o una app similar:</p>
          <QrCode value={setup.otpauth} label="Código QR para agregar la cuenta a tu app autenticadora" />
          <details>
            <summary>¿No puedes escanearlo? Ingresa la clave manualmente</summary>
            <code className="secret">{setup.secret.match(/.{1,4}/g).join(" ")}</code>
          </details>
          <label>Código generado<input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={6} required /></label>
          <button className="btn">Confirmar y activar</button>
        </form>
      ) : (
        <button className="btn" onClick={start}>Configurar MFA</button>
      )}
      {msg && <p className="muted">{msg}</p>}
    </section>
  );
}
