import { ENDPOINTS, request } from "../../../shared/api/index.js";
import { json } from "./helpers.js";

// T02 · Enviar precio manipulado en la cotización
export const manipulatedPrice = {
  id: "T02", name: "Enviar precio manipulado en la cotización",
  goal: "Pagar menos cambiando el precio que el navegador envía al servidor.",
  steps: [
    ["atacante", "Arma a mano una petición `POST /api/cart/quote`, como haría alguien con las herramientas de desarrollador o con un proxy como Burp Suite."],
    ["atacante", "Pide 1 «Café de Huehuetenango» (precio real Q95.00) y agrega campos falsos: `price: 1`, `unitPrice: 1` y `total: 1`, es decir, Q0.01."],
    ["servidor", "`parseItems` toma de cada línea solo `productId` y `qty`; `price`, `unitPrice` y `total` se descartan sin leerlos."],
    ["servidor", "`pricing.quote` carga el producto desde PostgreSQL (InsForge) y usa el precio guardado ahí (9500 centavos); las cuentas las hace `buildQuote`, una función pura del dominio."],
    ["servidor", "Recalcula subtotal, descuento, envío y total en centavos enteros y responde con esos importes. El carrito y el checkout solo muestran lo que calcula el servidor."],
  ],
  expect: "`200` con subtotal Q95.00: el precio manipulado no tuvo ningún efecto.",
  code: "server/modules/sales/domain/pricing.mjs · server/modules/sales/application/pricingService.mjs",
  run: async () => {
    const r = await request(ENDPOINTS.sales.quote.url(), json({ items: [{ productId: "cafe-huehue", qty: 1, price: 1, unitPrice: 1 }], total: 1 }));
    return { pass: r.ok && r.data.subtotal === 9500, status: r.status, detail: `El servidor ignoró price=1 y calculó subtotal Q${(r.data.subtotal / 100).toFixed(2)}` };
  },
};
