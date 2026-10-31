import { useNavigate } from "react-router-dom";
import { authApi, setCsrf } from "../../shared/api/index.js";
import { ROLE_LABEL } from "../../shared/lib/format.js";
import { useAuth } from "../auth/index.js";
import { MfaSection } from "./MfaSection.jsx";
import { PasswordSection } from "./PasswordSection.jsx";
import { AddressesSection } from "./AddressesSection.jsx";

export function AccountPage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const logoutAll = async () => {
    if (!confirm("¿Cerrar sesión en todos tus dispositivos?")) return;
    await authApi.logoutAll();
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
        {!user.mustChangePassword && <MfaSection />}
        <PasswordSection />
      </div>
      {!user.mustChangePassword && <AddressesSection />}
    </>
  );
}
