// Textos de cada tipo de alerta. El servidor decide QUE alerta llega y A QUIEN (domain/alerts.mjs);
// aqui solo se decide COMO se muestra.
import { money, ROLE_LABEL, STATUS } from "../../shared/lib/format.js";
import { eventLabel } from "../admin/index.js";

export const SEVERITY_ICON = { critical: "⛔", warning: "⚠️", success: "✓", info: "🔔" };
export const SEVERITY_LABEL = { critical: "Crítica", warning: "Advertencia", success: "Correcto", info: "Aviso" };

const shortId = (id) => `#${String(id).slice(0, 8)}`;
const stars = (rating) => "★".repeat(rating) + "☆".repeat(5 - rating);
const who = (d) => (d.actor ? `${d.actor.email} (${ROLE_LABEL[d.actor.role] ?? d.actor.role})` : `Alguien sin sesión (${d.ip})`);

const ORDER_STATUS_TEXT = {
  pagado: (id) => ["Pago confirmado", `Recibimos el pago de tu pedido ${id}.`],
  preparando: (id) => ["Estamos preparando tu pedido", `El pedido ${id} pasó a preparación.`],
  enviado: (id) => ["Tu pedido va en camino", `El pedido ${id} fue enviado.`],
  entregado: (id) => ["Pedido entregado", `El pedido ${id} se marcó como entregado. ¡Gracias por tu compra!`],
  cancelado: (id, from) => from === "pendiente_pago"
    ? ["Tu reserva venció", `El pedido ${id} no se pagó a tiempo y se liberó el inventario.`]
    : ["Pedido cancelado", `La tienda canceló tu pedido ${id}.`],
};

const KINDS = {
  "order.status": ({ orderId, status, from }) => {
    const [title, body] = (ORDER_STATUS_TEXT[status] ?? ((id) => ["Tu pedido cambió", `El pedido ${id} ahora está «${STATUS[status]?.label ?? status}».`]))(shortId(orderId), from);
    return { title, body, link: `/pedidos/${orderId}` };
  },
  "order.paid": ({ orderId, total }) => ({ title: "Nuevo pedido pagado", body: `Pedido ${shortId(orderId)} por ${money(total)}: listo para preparar.`, link: "/admin/pedidos" }),
  "order.cancelled": ({ orderId, from }) => ({ title: "Se anuló un pedido pagado", body: `El pedido ${shortId(orderId)} estaba «${STATUS[from]?.label ?? from}»: detén su preparación.`, link: "/admin/pedidos" }),
  "stock.low": ({ name, stock }) => ({ title: "Stock bajo", body: `Quedan ${stock} de «${name}».`, link: "/admin/productos" }),
  "stock.out": ({ name }) => ({ title: "Producto agotado", body: `«${name}» se quedó sin existencias.`, link: "/admin/productos" }),
  "review.pending": ({ productName, rating }) => ({ title: "Reseña nueva por revisar", body: `${stars(rating)} en «${productName}».`, link: "/admin/resenas" }),
  "account.new_login": ({ device, ip }) => ({ title: "Nuevo inicio de sesión en tu cuenta", body: `${device || "Dispositivo desconocido"} · ${ip}. Si no fuiste tú, cambia tu contraseña y cierra todas las sesiones.`, link: "/cuenta" }),
  "account.locked": ({ minutes, ip }) => ({ title: "Tu cuenta se bloqueó temporalmente", body: `Hubo varios intentos fallidos de inicio de sesión desde ${ip}. Se libera en ${minutes} min.`, link: "/cuenta" }),
  "account.mfa_disabled": ({ ip }) => ({ title: "Se desactivó la verificación en dos pasos", body: `Desde ${ip}. Si no fuiste tú, cambia tu contraseña de inmediato.`, link: "/cuenta" }),
  "security.lockout": (d) => ({ title: "Cuenta bloqueada por intentos fallidos", body: `${d.details?.cuenta ?? "Cuenta"} · por ${d.details?.alcance ?? "intentos"} · desde ${d.ip}.`, link: "/admin/accesos" }),
  "security.authz": (d) => ({ title: "Acceso denegado", body: `${who(d)} intentó ${d.target ?? "una acción sin permiso"}.`, link: "/admin/auditoria" }),
  "security.csrf": (d) => ({ title: "Petición bloqueada (CSRF)", body: `${eventLabel(d)} desde ${d.ip}.`, link: "/admin/auditoria" }),
  "security.ratelimit": (d) => ({ title: "Exceso de solicitudes bloqueado", body: `Límite «${d.details?.bucket}» superado desde ${d.ip}.`, link: "/admin/auditoria" }),
  "security.webhook": (d) => ({ title: "Aviso de pago rechazado", body: `Posible aviso falso de la pasarela: ${d.details?.reason ?? "firma o monto inválidos"}.`, link: "/admin/auditoria" }),
  "admin.change": (d) => ({ title: eventLabel(d), body: `${who(d)}${d.target ? ` · ${d.target}` : ""}.`, link: "/admin/auditoria" }),
};

/** Titulo, texto y enlace de una alerta (con un texto generico para tipos que esta version no conoce). */
export function describeAlert(alert) {
  const describe = KINDS[alert.kind];
  return describe ? describe(alert.data ?? {}) : { title: "Aviso", body: alert.kind, link: null };
}
