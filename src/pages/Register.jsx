import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../state.jsx";
import { AuthArt } from "./Login.jsx";

export default function Register() {
  const { applySession } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setError("Las contraseñas no coinciden");
    setBusy(true);
    setError("");
    try {
      const d = await api("/api/auth/register", { method: "POST", body: { name: form.name, email: form.email, password: form.password } });
      applySession(d);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="auth-shell">
      <AuthArt />
      <form className="auth-form form" onSubmit={submit}>
        <h1>Crea tu cuenta</h1>
        <p className="muted">Compra más rápido y sigue tus pedidos en tiempo real.</p>
        <label>Nombre<input value={form.name} onChange={set("name")} maxLength={80} autoComplete="name" required /></label>
        <label>Correo<input type="email" value={form.email} onChange={set("email")} autoComplete="email" required /></label>
        <label>
          Contraseña
          <input type="password" value={form.password} onChange={set("password")} minLength={12} maxLength={128} autoComplete="new-password" required />
          <small className="muted">Mínimo 12 caracteres. Te recomendamos una frase larga y fácil de recordar.</small>
        </label>
        <label>Confirmar contraseña<input type="password" value={form.confirm} onChange={set("confirm")} autoComplete="new-password" required /></label>
        {error && <p className="alert error">{error}</p>}
        <button className="btn block lg" disabled={busy}>{busy ? "Creando…" : "Crear cuenta"}</button>
        <p className="muted center">¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
      </form>
    </div>
  );
}
