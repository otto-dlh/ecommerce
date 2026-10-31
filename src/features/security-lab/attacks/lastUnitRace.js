import { ENDPOINTS, request } from "../../../shared/api/index.js";
import { json } from "./helpers.js";

// T14 · Dos compras simultáneas de la última unidad
export const lastUnitRace = {
  id: "T14", name: "Dos compras simultáneas de la última unidad",
  needsClient: true,
  goal: "Comprar la última unidad desde dos peticiones simultáneas para que ambas se confirmen (condición de carrera que provoca sobreventa).",
  steps: [
    ["atacante", "Con sesión de cliente, prepara un pedido de 1 «Jade tallado — edición limitada», que tiene 1 unidad en inventario."],
    ["atacante", "Lanza dos compras idénticas, A y B (`POST /api/orders`), al mismo tiempo, buscando que las dos lean «queda 1» antes de que la otra la descuente."],
    ["servidor", "Ambas llegan a `place_order`, una función de PostgreSQL que corre en una transacción y bloquea la fila del producto con `SELECT … FOR UPDATE`."],
    ["servidor", "A obtiene el bloqueo primero: ve «queda 1», descuenta la unidad, guarda el pedido y confirma la transacción (`201`)."],
    ["servidor", "B esperaba ese bloqueo; al obtenerlo ya lee «queda 0», así que la función lanza `out_of_stock` y PostgreSQL revierte todo lo de B."],
    ["servidor", "La API traduce el código a `409` «Sin existencias suficientes». Si B hubiera traído varios productos, ninguno quedaría reservado: todo o nada."],
    ["lab", "Cancela el pedido de prueba que se creó para devolver la unidad al inventario."],
  ],
  expect: "`201 / 409` (o `409 / 409` si ya no quedaba stock); nunca dos `201`, también en local.",
  code: "migrations/*_ascii-error-codes.sql (place_order) · server/infra/insforge/sales.mjs",
  run: async ({ user }) => {
    if (!user) return { skipped: true, status: "—", detail: "Requiere sesión: inicia sesión como cliente para ejecutarla" };
    const body = { items: [{ productId: "edicion-limitada", qty: 1 }], address: { name: "Prueba", line1: "Laboratorio 123", city: "Guatemala", phone: "55555555" } };
    const [a, b] = await Promise.all([request(ENDPOINTS.sales.placeOrder.url(), json(body)), request(ENDPOINTS.sales.placeOrder.url(), json(body))]);
    const created = [a, b].filter((r) => r.status === 201);
    for (const r of created) await request(ENDPOINTS.sales.cancelOrder.url({ id: r.data.order.id }), json({}));
    return {
      pass: created.length <= 1,
      status: `${a.status} / ${b.status}`,
      detail: created.length === 1 ? "Solo una compra obtuvo la unidad; la otra recibió 409 (pedido de prueba cancelado después)" : created.length === 0 ? "Sin stock disponible: ambas 409 (no hubo sobreventa)" : "¡Sobreventa detectada!",
    };
  },
};
