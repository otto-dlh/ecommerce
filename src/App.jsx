import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useAuth, useCart } from "./state.jsx";
import { isStaff } from "./permissions.js";
import { Brand } from "./components/Brand.jsx";
import { AlertBell, AlertToasts } from "./alerts/AlertCenter.jsx";
import Catalog from "./pages/Catalog.jsx";
import Product from "./pages/Product.jsx";
import Cart from "./pages/Cart.jsx";
import Checkout from "./pages/Checkout.jsx";
import Pay from "./pages/Pay.jsx";
import Orders from "./pages/Orders.jsx";
import OrderDetail from "./pages/OrderDetail.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Account from "./pages/Account.jsx";
import AdminPanel from "./pages/admin/index.jsx";
import Security from "./pages/Security.jsx";

const ACCOUNT_PATH = "/cuenta";

function RequireAuth({ children, staff = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="muted center" aria-busy="true">Cargando…</p>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  // Un administrador exigio cambiar la contrasena: la API rechaza todo lo demas hasta hacerlo
  if (user.mustChangePassword && location.pathname !== ACCOUNT_PATH) return <Navigate to={ACCOUNT_PATH} replace />;
  // Solo usabilidad: la autorizacion real la aplica la API en cada endpoint
  if (staff && !isStaff(user)) return <Navigate to="/" replace />;
  return children;
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Brand />
            <p>Prototipo académico de e-commerce desarrollado con seguridad desde el diseño para el curso Seguridad en Aplicaciones · UMG 2026.</p>
            <div className="badges">
              <span>OWASP ASVS 5.0.0</span><span>STRIDE</span><span>DREAD</span><span>ISO/IEC 27001</span><span>NIST SSDF</span>
            </div>
          </div>
          <div>
            <h4>Tienda</h4>
            <ul>
              <li><Link to="/">Catálogo</Link></li>
              <li><Link to="/carrito">Carrito</Link></li>
              <li><Link to="/pedidos">Mis pedidos</Link></li>
              <li><Link to="/cuenta">Mi cuenta</Link></li>
            </ul>
          </div>
          <div>
            <h4>Seguridad</h4>
            <ul>
              <li><Link to="/seguridad">Laboratorio de pruebas</Link></li>
              <li><Link to="/seguridad#controles">Matriz de controles</Link></li>
              <li><Link to="/seguridad#arquitectura">Arquitectura</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Tienda Segura · Universidad Mariano Gálvez de Guatemala</span>
          <span>Fotos de producto: Unsplash (Unsplash License) · Pagos simulados en sandbox — no uses datos reales.</span>
        </div>
      </div>
    </footer>
  );
}

function Header() {
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

/** Aviso cuando el servidor cerro la sesion (llega en vivo por el canal privado). */
function SessionNotice() {
  const { notice, clearNotice } = useAuth();
  if (!notice) return null;
  return (
    <div className="container">
      <p className="alert warn row between" role="alert">
        <span>{notice}</span>
        <span className="row"><Link to="/login" className="btn sm" onClick={clearNotice}>Iniciar sesión</Link><button className="btn ghost sm" onClick={clearNotice}>Cerrar</button></span>
      </p>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Header />
      <SessionNotice />
      <AlertToasts />
      <main className="container main">
        <Routes>
          <Route path="/" element={<Catalog />} />
          <Route path="/producto/:id" element={<Product />} />
          <Route path="/carrito" element={<Cart />} />
          <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
          <Route path="/pagar/:id" element={<RequireAuth><Pay /></RequireAuth>} />
          <Route path="/pedidos" element={<RequireAuth><Orders /></RequireAuth>} />
          <Route path="/pedidos/:id" element={<RequireAuth><OrderDetail /></RequireAuth>} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Register />} />
          <Route path="/cuenta" element={<RequireAuth><Account /></RequireAuth>} />
          <Route path="/admin/*" element={<RequireAuth staff><AdminPanel /></RequireAuth>} />
          <Route path="/seguridad" element={<Security />} />
          <Route path="*" element={<p className="center muted">Página no encontrada.</p>} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
