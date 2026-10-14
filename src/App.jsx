import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useAuth, useCart } from "./state.jsx";
import { ROLE_LABEL } from "./format.js";
import { Brand } from "./components/Brand.jsx";
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
import Admin from "./pages/Admin.jsx";
import Security from "./pages/Security.jsx";

function RequireAuth({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="muted center">Cargando…</p>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  // Solo usabilidad: la autorizacion real la aplica la API en cada endpoint
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
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
          {user && user.role !== "cliente" && <NavLink to="/admin">Administración</NavLink>}
        </nav>
        <div className="nav-right">
          <NavLink to="/carrito" className="cart-link">
            🛒 {count > 0 && <span className="badge">{count}</span>}
          </NavLink>
          {user ? (
            <>
              <NavLink to="/cuenta" className="user-chip" title={user.email}>
                <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
                <span>{user.name.split(" ")[0]} <small>· {ROLE_LABEL[user.role]}</small></span>
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

export default function App() {
  return (
    <>
      <Header />
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
          <Route path="/admin/*" element={<RequireAuth roles={["admin", "operador"]}><Admin /></RequireAuth>} />
          <Route path="/seguridad" element={<Security />} />
          <Route path="*" element={<p className="center muted">Página no encontrada.</p>} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
