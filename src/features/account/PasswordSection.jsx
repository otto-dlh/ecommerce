import { useState } from "react";
import { authApi } from "../../shared/api/index.js";
import { useAuth } from "../auth/index.js";

/** Cambio de contraseña (tambien sirve para reemplazar la temporal que entrega un administrador). */
export function PasswordSection() {
  const { applySession } = useAuth();
  const [form, setForm] = useState({ current: "", next: "" });
  const [msg, setMsg] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    try {
      // El cambio abre una sesion nueva (token, CSRF y canal realtime nuevos)
      applySession(await authApi.changePassword(form));
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
