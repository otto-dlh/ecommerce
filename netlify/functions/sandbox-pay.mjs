// Adaptador de Netlify para la pasarela de pagos simulada (proveedor externo, frontera F4).
// La logica vive en server/sandbox-gateway: cambiar de hosting no la toca.
import handler from "../../server/sandbox-gateway/handler.mjs";

export default handler;

export const config = { path: "/sandbox/pay" };
