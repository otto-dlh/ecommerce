import { Navigate, useLocation } from "react-router-dom";
import { isStaff } from "../shared/lib/permissions.js";
import { useAuth } from "../features/auth/index.js";

const ACCOUNT_PATH = "/cuenta";

/** Protege una ruta: exige sesion (y ser personal si `staff`); si no, redirige. */
export function RequireAuth({ children, staff = false }) {
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
