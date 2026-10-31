import { Brand } from "../../shared/ui/Brand.jsx";
import "./auth.css";

/** Panel lateral de las pantallas de acceso: marca y controles que protegen la cuenta. */
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
