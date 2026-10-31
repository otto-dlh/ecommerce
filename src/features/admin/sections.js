// Secciones del panel: una sola configuracion genera las pestanas y las rutas.
// `perm` es el permiso minimo para VER la seccion; dentro, cada accion revisa su propio permiso.
import { lazy } from "react";

export const ADMIN_SECTIONS = [
  { path: "", label: "Resumen", perm: "stats:read", Component: lazy(() => import("./sections/Dashboard.jsx")) },
  { path: "productos", label: "Productos e inventario", perm: "inventory:read", Component: lazy(() => import("./sections/Products.jsx")) },
  { path: "categorias", label: "Categorías", perm: "categories:read", Component: lazy(() => import("./sections/Categories.jsx")) },
  { path: "cupones", label: "Cupones", perm: "coupons:read", Component: lazy(() => import("./sections/Coupons.jsx")) },
  { path: "pedidos", label: "Pedidos", perm: "orders:read", Component: lazy(() => import("./sections/Orders.jsx")) },
  { path: "clientes", label: "Clientes", perm: "customers:read", Component: lazy(() => import("./sections/Customers.jsx")) },
  { path: "resenas", label: "Reseñas", perm: "reviews:moderate", Component: lazy(() => import("./sections/Reviews.jsx")) },
  { path: "usuarios", label: "Usuarios", perm: "users:read", Component: lazy(() => import("./sections/Users.jsx")) },
  { path: "accesos", label: "Accesos", perm: "access:read", Component: lazy(() => import("./sections/Access.jsx")) },
  { path: "auditoria", label: "Auditoría", perm: "audit:read", Component: lazy(() => import("./sections/Audit.jsx")) },
];
