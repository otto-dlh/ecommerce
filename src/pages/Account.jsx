import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setCsrf } from "../api.js";
import { ROLE_LABEL } from "../format.js";
import { useAuth } from "../state.jsx";
import { ListSkeleton } from "../components/Skeleton.jsx";
import { QrCode } from "../components/QrCode.jsx";

function Mfa() {
  const { user, refresh } = useAuth();
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const start = async () => {
    setMsg("");
    try { setSetup(await api("/api/auth/mfa/setup", { method: "POST" })); } catch (e) { setMsg(e.message); }
  };
  const enable = async (e) => {
    e.preventDefault();
    try {
      await api("/api/auth/mfa/enable", { method: "POST", body: { code } });
      setSetup(null); setCode(""); setMsg("MFA activado. Se cerraron tus otras sesiones."); refresh();
    } catch (err) { setMsg(err.message); }
  };
  const disable = async (e) => {
    e.preventDefault();
    try {
      await api("/api/auth/mfa/disable", { method: "POST", body: { code, password } });
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

function Password() {
  const { applySession } = useAuth();
  const [form, setForm] = useState({ current: "", next: "" });
  const [msg, setMsg] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    try {
      // El cambio abre una sesion nueva (token, CSRF y canal realtime nuevos)
      applySession(await api("/api/auth/password", { method: "POST", body: form }));
      setForm({ current: "", next: "" });
      setMsg("Contraseña actualizada. Se cerraron las demás sesiones.");
    } catch (err) { setMsg(err.message); }
  };
  return (
    <section className="panel">
      <h2>Cambiar contraseña</h2>
      <form className="form narrow" onSubmit={submit}>
        <label>Actual (o la temporal que te entregaron)<input type="password" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} autoComplete="current-password" required /></label>
        <label>Nueva (mín. 12)<input type="password" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} minLength={12} autoComplete="new-password" required /></label>
        <button className="btn">Actualizar</button>
        {msg && <p className="muted">{msg}</p>}
      </form>
    </section>
  );
}

function Addresses() {
  const [list, setList] = useState(null); // null = cargando
  // Si falla la primera carga se muestra el estado vacío; si falla una recarga se conserva la lista
  const load = () => api("/api/addresses").then((d) => setList(d.addresses)).catch(() => setList((cur) => cur ?? []));
  useEffect(() => { load(); }, []);
  const remove = async (id) => { await api(`/api/addresses/${id}`, { method: "DELETE" }); load(); };
  return (
    <section className="panel">
      <h2>Direcciones guardadas</h2>
      {list === null ? <ListSkeleton items={2} label="Cargando direcciones…" /> : list.length === 0 ? <p className="muted">Puedes guardar direcciones durante el checkout.</p> : (
        <ul className="plain">
          {list.map((a) => (
            <li key={a.id} className="row between">
              <span>{a.name} — {a.line1}, {a.city} · {a.phone}</span>
              <button className="btn ghost sm" onClick={() => remove(a.id)}>Eliminar</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Account() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const logoutAll = async () => {
    if (!confirm("¿Cerrar sesión en todos tus dispositivos?")) return;
    await api("/api/auth/logout-all", { method: "POST" });
    setCsrf(null);
    await refresh();
    navigate("/login");
  };
  return (
    <>
      <h1>Mi cuenta</h1>
      {user.mustChangePassword && (
        <p className="alert warn" role="alert">
          Un administrador restableció tu contraseña. Elige una nueva para continuar: hasta entonces el resto de la tienda queda bloqueado.
        </p>
      )}
      <section className="panel row between">
        <div>
          <b>{user.name}</b> <span className="tag">{user.roleLabel ?? ROLE_LABEL[user.role]}</span>
          <div className="muted">{user.email}</div>
        </div>
        <button className="btn ghost" onClick={logoutAll}>Cerrar todas las sesiones</button>
      </section>
      <div className="two-col even">
        {!user.mustChangePassword && <Mfa />}
        <Password />
      </div>
      {!user.mustChangePassword && <Addresses />}
    </>
  );
}
