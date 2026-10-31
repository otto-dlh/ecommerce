// Tabla de rutas de la tienda: cada pantalla viene de la API publica (index.js) de su feature.
import { Route, Routes } from "react-router-dom";
import { CatalogPage, ProductPage } from "../features/catalog/index.js";
import { CartPage } from "../features/cart/index.js";
import { CheckoutPage, PayPage } from "../features/checkout/index.js";
import { OrderDetailPage, OrdersPage } from "../features/orders/index.js";
import { LoginPage, RegisterPage } from "../features/auth/index.js";
import { AccountPage } from "../features/account/index.js";
import { AdminPanel } from "../features/admin/index.js";
import { SecurityPage } from "../features/security-lab/index.js";
import { RequireAuth } from "./RequireAuth.jsx";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<CatalogPage />} />
      <Route path="/producto/:id" element={<ProductPage />} />
      <Route path="/carrito" element={<CartPage />} />
      <Route path="/checkout" element={<RequireAuth><CheckoutPage /></RequireAuth>} />
      <Route path="/pagar/:id" element={<RequireAuth><PayPage /></RequireAuth>} />
      <Route path="/pedidos" element={<RequireAuth><OrdersPage /></RequireAuth>} />
      <Route path="/pedidos/:id" element={<RequireAuth><OrderDetailPage /></RequireAuth>} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegisterPage />} />
      <Route path="/cuenta" element={<RequireAuth><AccountPage /></RequireAuth>} />
      <Route path="/admin/*" element={<RequireAuth staff><AdminPanel /></RequireAuth>} />
      <Route path="/seguridad" element={<SecurityPage />} />
      <Route path="*" element={<p className="center muted">Página no encontrada.</p>} />
    </Routes>
  );
}
