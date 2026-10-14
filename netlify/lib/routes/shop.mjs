import { randomUUID } from "node:crypto";
import { HttpError } from "../http.mjs";
import { getJSON, putJSON, listJSON } from "../store.mjs";
import * as v from "../validate.mjs";
import { can } from "../auth.mjs";
import { rateLimit } from "../ratelimit.mjs";
import { audit } from "../audit.mjs";
import { parseAddress } from "./auth.mjs";
import {
  parseItems, quote, reserveStock, releaseStock, transition, expireIfNeeded, PAYMENT_WINDOW_MS, COUPONS,
} from "../orders.mjs";

const publicProduct = ({ id, name, description, price, category, emoji, color, image, stock }) => ({
  id, name, description, price, category, emoji, color, image: image ?? null, stock,
});

/** Devuelve el pedido solo si pertenece al usuario o si tiene permiso de gestion (ASVS v5.0.0-8.2.2, T04). */
export async function loadOrderFor(ctx, id) {
  const order = await getJSON("orders", v.id(id));
  if (!order || (order.userId !== ctx.user.id && !can(ctx.user, "orders:manage"))) {
    if (order) await audit(ctx, "authz.denied", { outcome: "denied", target: `order:${order.id}` });
    // Mismo 404 exista o no: no se revela la existencia de pedidos ajenos
    throw new HttpError(404, "Pedido no encontrado");
  }
  return expireIfNeeded(order);
}

export default function shopRoutes(add) {
  add("GET", "/api/products", {}, async (ctx) => {
    const p = ctx.url.searchParams;
    // La busqueda se trata como texto literal; no se construyen consultas con ella (T08)
    const q = v.str(p.get("q") ?? "", "q", { optional: true, max: 60 }).toLowerCase();
    const category = v.str(p.get("category") ?? "", "category", { optional: true, max: 40 });
    const sort = v.oneOf(p.get("sort") || "relevancia", "sort", ["relevancia", "precio-asc", "precio-desc", "nombre"]);
    let items = (await listJSON("products")).filter((x) => x.active);
    if (q) items = items.filter((x) => `${x.name} ${x.description}`.toLowerCase().includes(q));
    if (category) items = items.filter((x) => x.category === category);
    if (sort === "precio-asc") items.sort((a, b) => a.price - b.price);
    if (sort === "precio-desc") items.sort((a, b) => b.price - a.price);
    if (sort === "nombre") items.sort((a, b) => a.name.localeCompare(b.name, "es"));
    return { products: items.map(publicProduct) };
  });

  add("GET", "/api/categories", {}, async () => {
    const items = (await listJSON("products")).filter((x) => x.active);
    return { categories: [...new Set(items.map((x) => x.category))].sort() };
  });

  add("GET", "/api/products/:id", {}, async (ctx) => {
    const p = await getJSON("products", v.id(ctx.params.id));
    if (!p || !p.active) throw new HttpError(404, "Producto no encontrado");
    const reviews = (await listJSON("reviews", `${p.id}/`))
      .filter((r) => !r.hidden)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(({ id, userName, rating, text, createdAt }) => ({ id, userName, rating, text, createdAt }));
    return { product: publicProduct(p), reviews };
  });

  add("POST", "/api/products/:id/reviews", { auth: true }, async (ctx) => {
    await rateLimit(ctx, "review", ctx.user.id, 5, 600);
    const p = await getJSON("products", v.id(ctx.params.id));
    if (!p || !p.active) throw new HttpError(404, "Producto no encontrado");
    const rating = v.int(ctx.body.rating, "calificación", { min: 1, max: 5 });
    // Se guarda el texto tal cual; la proteccion XSS es la codificacion de salida en React + CSP (T07)
    const text = v.str(ctx.body.text, "reseña", { min: 3, max: 500 });
    const review = {
      id: randomUUID(), productId: p.id, userId: ctx.user.id, userName: ctx.user.name.split(" ")[0],
      rating, text, createdAt: new Date().toISOString(), hidden: false,
    };
    await putJSON("reviews", `${p.id}/${review.id}`, review);
    ctx.status = 201;
    return { review: { id: review.id, userName: review.userName, rating, text, createdAt: review.createdAt } };
  });

  add("GET", "/api/coupons", {}, async () => ({
    coupons: Object.entries(COUPONS).map(([code, c]) => ({ code, label: c.label })),
  }));

  // Cotizacion: el frontend muestra siempre los importes que calcula el servidor
  add("POST", "/api/cart/quote", {}, async (ctx) => {
    return quote(parseItems(ctx.body.items), ctx.body.coupon || null, ctx.user);
  });

  add("POST", "/api/orders", { auth: true }, async (ctx) => {
    await rateLimit(ctx, "checkout", ctx.user.id, 10, 600);
    const items = parseItems(ctx.body.items);
    const address = parseAddress(ctx.body.address);
    const q = await quote(items, ctx.body.coupon || null, ctx.user);
    await reserveStock(items);
    const now = Date.now();
    const order = {
      id: randomUUID(),
      userId: ctx.user.id,
      items: q.lines.map(({ productId, name, unitPrice, qty, lineTotal }) => ({ productId, name, unitPrice, qty, lineTotal })),
      subtotal: q.subtotal, discount: q.discount, shipping: q.shipping, total: q.total,
      coupon: q.coupon?.code ?? null,
      address,
      status: "pendiente_pago",
      history: [{ status: "pendiente_pago", at: new Date(now).toISOString(), by: ctx.user.id }],
      payment: null,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + PAYMENT_WINDOW_MS).toISOString(),
    };
    try {
      await putJSON("orders", order.id, order, { onlyIfNew: true });
    } catch (err) {
      await releaseStock(items);
      throw err;
    }
    await audit(ctx, "order.created", { target: `order:${order.id}`, details: { total: order.total } });
    ctx.status = 201;
    return { order };
  });

  add("GET", "/api/orders", { auth: true }, async (ctx) => {
    const mine = (await listJSON("orders")).filter((o) => o.userId === ctx.user.id);
    const orders = await Promise.all(mine.map(expireIfNeeded));
    orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { orders };
  });

  add("GET", "/api/orders/:id", { auth: true }, async (ctx) => ({ order: await loadOrderFor(ctx, ctx.params.id) }));

  add("POST", "/api/orders/:id/cancel", { auth: true }, async (ctx) => {
    const order = await loadOrderFor(ctx, ctx.params.id);
    if (order.userId !== ctx.user.id) throw new HttpError(404, "Pedido no encontrado");
    if (order.status !== "pendiente_pago") throw new HttpError(409, "Solo se pueden cancelar pedidos pendientes de pago");
    const { order: updated } = await transition(order.id, "cancelado", ctx.user.id);
    await audit(ctx, "order.status", { target: `order:${order.id}`, details: { from: "pendiente_pago", to: "cancelado" } });
    return { order: updated };
  });
}
