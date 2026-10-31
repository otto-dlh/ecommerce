import { ENDPOINTS, request } from "../../../shared/api/index.js";
import { can } from "../../../shared/lib/permissions.js";

// T04 · Leer el pedido de otro cliente (IDOR)
export const readOtherOrder = {
  id: "T04", name: "Leer el pedido de otro cliente (IDOR)",
  goal: "Ver la dirección, el teléfono y las compras de otra persona cambiando el identificador del pedido en la URL (referencia directa insegura a objetos).",
  steps: [
    ["atacante", "Inicia sesión con una cuenta normal de cliente (sirve una recién creada en «Crear cuenta»)."],
    ["atacante", "Pide `GET /api/orders/demo-pedido-cliente2`, un pedido que pertenece a otra cuenta. Equivale a cambiar el número de pedido en la barra de direcciones de «Mis pedidos»."],
    ["servidor", "Valida la cookie de sesión e identifica al usuario. Sin sesión, se detiene aquí con `401`."],
    ["servidor", "`orders.getForActor` carga el pedido y compara su dueño con el usuario de la sesión: no coincide, y el rol cliente no tiene el permiso `orders:read` (solo operador, auditor y administrador)."],
    ["bitacora", "Registra «Acceso denegado» con el pedido que se intentó ver."],
    ["servidor", "Responde `404` «Pedido no encontrado», igual que si no existiera: el atacante no puede confirmar que el pedido existe."],
  ],
  expect: "`404` como cliente y `401` sin sesión. Con cliente2, operador, auditor o administrador responde `200` porque el acceso es legítimo.",
  evidence: "Administración → Auditoría: «Acceso denegado»",
  code: "server/modules/sales/application/orderService.mjs · server/modules/identity/domain/permissions.mjs",
  run: async ({ user }) => {
    const r = await request(ENDPOINTS.sales.order.url({ id: "demo-pedido-cliente2" }));
    // Legitimo si el pedido es propio o si el rol puede leer pedidos de otros
    const legit = user && ((r.status === 200 && r.data.order?.userId === user.id) || can(user, "orders:read"));
    if (!user) return { pass: r.status === 401, status: r.status, detail: "Sin sesión: 401" };
    if (legit) return { pass: r.status === 200, status: r.status, detail: "Tu rol/titularidad sí permite verlo (acceso legítimo)" };
    return { pass: r.status === 404, status: r.status, detail: "Respuesta 404 uniforme; el intento quedó en auditoría" };
  },
};
