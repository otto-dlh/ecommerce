import { Link } from "react-router-dom";
import { useAuth } from "../../features/auth/index.js";

/** Aviso cuando el servidor cerro la sesion (llega en vivo por el canal privado). */
export function SessionNotice() {
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
