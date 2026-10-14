import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../state.jsx";
import { Brand } from "../components/Brand.jsx";

const DEMO = [
  ["admin@tienda.test", "Admin#Demo2026!", "Administrador"],
  ["operador@tienda.test", "Operador#Demo2026!", "Operador"],
  ["cliente@tienda.test", "Cliente#Demo2026!", "Cliente"],
  ["cliente2@tienda.test", "Cliente2#Demo2026!", "Cliente 2"],
];

// Solo se aceptan rutas internas como destino tras el login (evita open redirect)
const safeNext = (n) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/");

export default function Login() {
  const { applySession } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaToken, setMfaToken] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const done = (d) => {
    applySession(d);
    navigate(safeNext(params.get("next")), { replace: true });
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const d = await api("/api/auth/login", { method: "POST", body: { email, password } });
      if (d.mfaRequired) setMfaToken(d.mfaToken);
      else done(d);
    } catch (err) {
      setError(err.status === 429 ? `${err.message} (espera ${Math.ceil((err.data.retryAfter || 60) / 60)} min)` : err.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      done(await api("/api/auth/mfa/verify", { method: "POST", body: { mfaToken, code } }));
    } catch (err) {
      setError(err.message);
      if (err.status === 401 && /expir/i.test(err.message)) setMfaToken(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell">
      <AuthArt />
      <div className="auth-form">
        {!mfaToken ? (
          <form className="form" onSubmit={submit}>
            <h1>Bienvenido de vuelta</h1>
            <p className="muted">Ingresa para ver tus pedidos y completar tu compra.</p>
            <label>Correo<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="tu@correo.com" required /></label>
            <label>Contraseña<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••••••" required /></label>
            {error && <p className="alert error">{error}</p>}
            <button className="btn block lg" disabled={busy}>{busy ? "Verificando…" : "Ingresar"}</button>
            <p className="muted center">¿No tienes cuenta? <Link to="/registro">Crea una gratis</Link></p>
          </form>
        ) : (
          <form className="form" onSubmit={verify}>
            <h1>Verificación en dos pasos</h1>
            <p className="muted">Ingresa el código de 6 dígitos de tu app autenticadora.</p>
            <label>Código<input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus /></label>
            {error && <p className="alert error">{error}</p>}
            <button className="btn block lg" disabled={busy}>Verificar</button>
          </form>
        )}
        <div className="divider">Cuentas de demostración</div>
        <div className="demo-grid">
          {DEMO.map(([u, p, r]) => (
            <button key={u} type="button" className="demo-user" onClick={() => { setEmail(u); setPassword(p); setMfaToken(null); }}>
              <b>{r}</b><span>{u}</span>
            </button>
          ))}
        </div>
        <p className="hint">Tras 5 intentos fallidos por cuenta en 15 minutos la API responde 429 (T01).</p>
      </div>
    </div>
  );
}

export function AuthArt() {
  return (
    <aside className="auth-art">
      <Brand />
      <div>
        <span className="eyebrow"><span className="dot" /> Sesión protegida</span>
        <h2>Tu cuenta, blindada de punta a punta.</h2>
        <p>Cada inicio de sesión pasa por los mismos controles que se definieron en el modelo de amenazas.</p>
      </div>
      <ul className="feature-list">
        <li><i>🔐</i> Contraseñas con scrypt y verificación en dos pasos (TOTP)</li>
        <li><i>🍪</i> Cookies HttpOnly, Secure y SameSite=Strict</li>
        <li><i>🚦</i> Límite de intentos contra fuerza bruta</li>
        <li><i>📜</i> Cada acceso queda en la bitácora de auditoría</li>
      </ul>
    </aside>
  );
}
