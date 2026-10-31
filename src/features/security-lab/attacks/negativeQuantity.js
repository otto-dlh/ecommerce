import { ENDPOINTS, request } from "../../../shared/api/index.js";
import { json } from "./helpers.js";

// T02 · Cantidad negativa
export const negativeQuantity = {
  id: "T02", name: "Cantidad negativa",
  goal: "Que una cantidad negativa reste dinero del total o devuelva unidades al inventario.",
  steps: [
    ["atacante", "Envía `POST /api/cart/quote` con `qty: -5` de café, esperando que esa línea valga −Q475.00 y reste del total del carrito."],
    ["servidor", "`parseItems` valida cada línea con `validate.int`: exige un número entero entre 1 y 10 (también rechaza decimales, textos y valores vacíos)."],
    ["servidor", "`-5` no cumple: la petición se corta ahí, antes de calcular importes o de tocar el inventario."],
  ],
  expect: "`400` «cantidad debe ser un entero entre 1 y 10».",
  code: "server/modules/sales/domain/pricing.mjs · server/shared/domain/validate.mjs",
  run: async () => {
    const r = await request(ENDPOINTS.sales.quote.url(), json({ items: [{ productId: "cafe-huehue", qty: -5 }] }));
    return { pass: r.status === 400, status: r.status, detail: r.data.error };
  },
};
