import { ENDPOINTS, request } from "../../../shared/api/index.js";

// T09 · Webhook de pago falsificado
export const forgedWebhook = {
  id: "T09", name: "Webhook de pago falsificado",
  goal: "Marcar un pedido como pagado sin pagar, haciéndose pasar por la pasarela de pagos.",
  steps: [
    ["atacante", "Arma un aviso `payment.succeeded` con un identificador de evento inventado."],
    ["atacante", "Lo envía a `POST /api/payments/webhook` con la cabecera `Sandbox-Signature`: marca de tiempo actual y una firma inventada (`v1=deadbeef`), porque no conoce la clave secreta de la pasarela."],
    ["servidor", "Esta ruta no usa sesión ni token CSRF porque la llama un servidor, no un navegador: la firma es su única credencial."],
    ["servidor", "Revisa la marca de tiempo: está dentro de la ventana de 5 minutos, así que continúa. Un aviso viejo reenviado se rechazaría aquí."],
    ["servidor", "Calcula HMAC-SHA256 de la marca de tiempo unida al cuerpo exacto, con una clave derivada solo para webhooks, y la compara en tiempo constante con la firma recibida: no coincide."],
    ["bitacora", "Registra «Aviso de pago rechazado» con el motivo «firma inválida»."],
    ["servidor", "Responde `401` y se detiene. Ni siquiera llega a las defensas siguientes: que el evento no se haya procesado antes y que el monto y la moneda coincidan con los del pedido."],
  ],
  expect: "`401` «Webhook rechazado»; el pedido no cambia de estado.",
  evidence: "Administración → Auditoría: «Aviso de pago rechazado»",
  code: "server/modules/sales/application/paymentService.mjs · server/modules/sales/domain/payments.mjs",
  run: async () => {
    const fake = JSON.stringify({ id: "evt_falsificado123456", type: "payment.succeeded", data: { orderId: "x", amount: 1, currency: "GTQ" } });
    const r = await request(ENDPOINTS.sales.paymentWebhook.url(), { method: "POST", csrf: false, body: fake, headers: { "Sandbox-Signature": `t=${Math.floor(Date.now() / 1000)},v1=deadbeef` } });
    return { pass: r.status === 401, status: r.status, detail: "Firma HMAC inválida → rechazado y auditado" };
  },
};
