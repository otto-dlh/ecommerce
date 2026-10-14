import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setCsrf } from "./api.js";

const AuthCtx = createContext(null);
const CartCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const d = await api("/api/auth/me");
      setCsrf(d.csrf);
      setUser(d.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const applySession = useCallback((d) => {
    setCsrf(d.csrf);
    setUser(d.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      setCsrf(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, loading, refresh, applySession, logout }), [user, loading, refresh, applySession, logout]);
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
