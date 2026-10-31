// Sesion del usuario en el navegador: quien es, su token CSRF y su canal realtime privado.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi, setCsrf } from "../../shared/api/index.js";

const AuthCtx = createContext(null);

// Por que termino una sesion desde el servidor (aviso realtime "session.revoked")
const SESSION_END_MESSAGES = {
  closed_by_admin: "Un administrador cerró tu sesión.",
  account_changed: "Tu cuenta o tus permisos cambiaron. Vuelve a iniciar sesión.",
  password_reset: "Un administrador restableció tu contraseña. Ingresa con la contraseña temporal que te entregó.",
  mfa_reset: "Un administrador reinició tu MFA. Vuelve a iniciar sesión.",
  password_changed: "Tu contraseña se cambió desde otro dispositivo.",
  mfa_enabled: "Se activó MFA en tu cuenta. Vuelve a iniciar sesión en este dispositivo.",
  logout_all: "Se cerraron todas tus sesiones.",
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [realtimeChannel, setRealtimeChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const applySession = useCallback((d) => {
    setCsrf(d.csrf);
    setUser(d.user);
    setRealtimeChannel(d.realtimeChannel ?? null);
  }, []);

  const clearSession = useCallback(() => {
    setCsrf(null);
    setUser(null);
    setRealtimeChannel(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      applySession(await authApi.me());
    } catch {
      clearSession();
    } finally {
      setLoading(false);
    }
  }, [applySession, clearSession]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  /** El servidor revoco la sesion: se olvida en el navegador y se explica el motivo. */
  const endSessionLocally = useCallback((reason) => {
    clearSession();
    setNotice(SESSION_END_MESSAGES[reason] ?? "Tu sesión terminó. Vuelve a iniciar sesión.");
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, loading, realtimeChannel, notice, clearNotice: () => setNotice(""), refresh, applySession, logout, endSessionLocally }),
    [user, loading, realtimeChannel, notice, refresh, applySession, logout, endSessionLocally],
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
