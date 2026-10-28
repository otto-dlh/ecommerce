import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setCsrf } from "./api.js";

const AuthCtx = createContext(null);
const CartCtx = createContext(null);

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
      applySession(await api("/api/auth/me"));
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
      await api("/api/auth/logout", { method: "POST" });
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

// El carrito local guarda solo productId y cantidad: precios y totales siempre vienen del servidor.
export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("cart") || "[]");
      return Array.isArray(parsed) ? parsed.filter((i) => typeof i.productId === "string" && Number.isInteger(i.qty)) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(items));
  }, [items]);

  const value = useMemo(
    () => ({
      items,
      count: items.reduce((s, i) => s + i.qty, 0),
      add: (productId, qty = 1) =>
        setItems((cur) => {
          const found = cur.find((i) => i.productId === productId);
          if (found) return cur.map((i) => (i.productId === productId ? { ...i, qty: Math.min(10, i.qty + qty) } : i));
          return [...cur, { productId, qty: Math.min(10, qty) }];
        }),
      setQty: (productId, qty) =>
        setItems((cur) => cur.map((i) => (i.productId === productId ? { ...i, qty: Math.max(1, Math.min(10, qty)) } : i))),
      remove: (productId) => setItems((cur) => cur.filter((i) => i.productId !== productId)),
      clear: () => setItems([]),
    }),
    [items]
  );
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
export const useCart = () => useContext(CartCtx);
