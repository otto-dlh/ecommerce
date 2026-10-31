// Pasarela de pagos (proveedor externo simulado, frontera F4): los datos de la tarjeta van directo a ella,
// nunca a la API de la tienda. Sin token CSRF de la tienda: es otro sistema.
import { ENDPOINTS } from "./endpoints.js";
import { requestEndpoint } from "./callEndpoint.js";

export const paymentGatewayApi = {
  /** Respuesta cruda { ok, status, data }: la pasarela responde 200 tambien cuando rechaza la tarjeta. */
  pay: ({ orderId, amount, card }) => requestEndpoint(ENDPOINTS.paymentGateway.pay, { csrf: false, body: { orderId, amount, card } }),
};
