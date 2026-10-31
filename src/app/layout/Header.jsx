import { NavLink, useNavigate } from "react-router-dom";
import { isStaff } from "../../shared/lib/permissions.js";
import { Brand } from "../../shared/ui/Brand.jsx";
import { useAuth } from "../../features/auth/index.js";
import { useCart } from "../../features/cart/index.js";
import { AlertBell } from "../../features/alerts/index.js";
import "./header.css";

/** Barra superior: marca, navegacion, alertas, carrito y sesion. */
export function Header() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Brand />
        <nav className="nav">
          <NavLink to="/" end>Catálogo</NavLink>
          <NavLink to="/seguridad">Seguridad</NavLink>
          {user && <NavLink to="/pedidos">Mis pedidos</NavLink>}
          {isStaff(user) && <NavLink to="/admin">Administración</NavLink>}
        </nav>
        <div className="nav-right">
          {user && <AlertBell />}
          <NavLink to="/carrito" className="cart-link">
            🛒 {count > 0 && <span className="badge">{count}</span>}
          </NavLink>
          {user ? (
            <>
              <NavLink to="/cuenta" className="user-chip" title={user.email}>
                <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
                <span>{user.name.split(" ")[0]} <small>· {user.roleLabel}</small></span>
              </NavLink>
              <button className="btn ghost sm" onClick={async () => { await logout(); navigate("/"); }}>
                Salir
              </button>
            </>
          ) : (
            <NavLink to="/login" className="btn sm">Ingresar</NavLink>
          )}
        </div>
      </div>
    </header>
  );
}
