import { HttpError } from "../http.mjs";
import { getJSON, putJSON, mutateJSON, listJSON } from "../store.mjs";
import * as v from "../validate.mjs";
import { ROLES, publicUser, revokeUserSessions } from "../auth.mjs";
import { audit, readAudit } from "../audit.mjs";
import { transition, expireIfNeeded, TRANSITIONS } from "../orders.mjs";

function parseProduct(b, partial = false) {
  const out = {};
  const opt = (k) => partial && b[k] === undefined;
  if (!opt("name")) out.name = v.str(b.name, "nombre", { min: 3, max: 80 });
  if (!opt("description")) out.description = v.str(b.description, "descripción", { min: 3, max: 400 });
  if (!opt("price")) out.price = v.int(b.price, "precio (centavos)", { min: 100, max: 10_000_000 });
  if (!opt("category")) out.category = v.str(b.category, "categoría", { min: 2, max: 40 });
  if (!opt("emoji")) out.emoji = v.str(b.emoji, "emoji", { min: 1, max: 8 });
  if (!opt("color")) out.color = v.str(b.color, "color", { pattern: /^#[0-9a-fA-F]{6}$/ });
  if (!opt("active")) out.active = v.bool(b.active, "activo");
  // Solo rutas locales: no se aceptan URLs externas (la CSP las bloquearia y evita rastreo de terceros)
  if (b.image !== undefined && b.image !== null && b.image !== "") {
    out.image = v.str(b.image, "imagen", { max: 80, pattern: /^\/products\/[a-z0-9-]+\.(jpg|png|webp)$/ });
  } else if (b.image === "" || b.image === null) {
    out.image = null;
  }
  return out;
}

export default function adminRoutes(add) {
  add("GET", "/api/admin/stats", { perm: "stats:read" }, async () => {
    const [orders, products] = await Promise.all([listJSON("orders"), listJSON("products")]);
    const byStatus = {};
    let revenue = 0;
    for (const o of orders) {
      byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
      if (["pagado", "preparando", "enviado", "entregado"].includes(o.status)) revenue += o.total;
    }
    const since = Date.now() - 24 * 3600 * 1000;
    const recent = (await readAudit(300)).filter((e) => Date.parse(e.at) >= since);
    return {
      revenue,
      orders: orders.length,
      byStatus,
      lowStock: products.filter((p) => p.active && p.stock <= 3).map(({ id, name, stock }) => ({ id, name, stock })),
      security: {
        loginFailures24h: recent.filter((e) => e.action === "auth.login" && e.outcome === "failure").length,
        authzDenied24h: recent.filter((e) => e.action === "authz.denied").length,
        rateLimited24h: recent.filter((e) => e.action === "ratelimit.block").length,
        webhookRejected24h: recent.filter((e) => e.action === "payment.webhook" && e.outcome !== "ok").length,
        csrfRejected24h: recent.filter((e) => e.action.startsWith("csrf.")).length,
      },
    };
  });

  // ---- Catalogo e inventario ----
  add("GET", "/api/admin/products", { perm: "inventory:write" }, async () => {
    const products = await listJSON("products");
    return { products: products.sort((a, b) => a.name.localeCompare(b.name, "es")) };
  });

  add("POST", "/api/admin/products", { perm: "catalog:write" }, async (ctx) => {
    const data = parseProduct(ctx.body);
    const id = v.str(ctx.body.id, "id", { min: 3, max: 40, pattern: /^[a-z0-9-]+$/ });
    const now = new Date().toISOString();
    const product = { id, ...data, stock: 0, createdAt: now, updatedAt: now };
    const r = await putJSON("products", id, product, { onlyIfNew: true });
    if (!r.modified) throw new HttpError(409, "Ya existe un producto con ese id");
    await audit(ctx, "product.create", { target: `product:${id}` });
    ctx.status = 201;
    return { product };
  });

  add("PUT", "/api/admin/products/:id", { perm: "catalog:write" }, async (ctx) => {
    const id = v.id(ctx.params.id);
    const changes = parseProduct(ctx.body, true);
    const product = await mutateJSON("products", id, (p) => ({ ...p, ...changes, updatedAt: new Date().toISOString() }));
    if (!product) throw new HttpError(404, "Producto no encontrado");
    await audit(ctx, "product.update", { target: `product:${id}`, details: changes });
    return { product };
  });

  add("POST", "/api/admin/products/:id/stock", { perm: "inventory:write" }, async (ctx) => {
    const id = v.id(ctx.params.id);
    const delta = v.int(ctx.body.delta, "ajuste", { min: -1000, max: 1000 });
    if (delta === 0) throw new HttpError(400, "El ajuste no puede ser 0");
    const reason = v.str(ctx.body.reason, "motivo", { min: 3, max: 200 });
    let before = 0;
    const product = await mutateJSON("products", id, (p) => {
      before = p.stock;
      if (p.stock + delta < 0) throw new HttpError(409, "El inventario no puede quedar negativo");
      return { ...p, stock: p.stock + delta, updatedAt: new Date().toISOString() };
    });
    if (!product) throw new HttpError(404, "Producto no encontrado");
    // Quien, cuando, cuanto y por que (T03 - no repudio)
    await audit(ctx, "stock.adjust", { target: `product:${id}`, details: { before, after: product.stock, delta, reason } });
    return { product };
  });

  // ---- Pedidos ----
  add("GET", "/api/admin/orders", { perm: "orders:manage" }, async () => {
    const orders = await Promise.all((await listJSON("orders")).map(expireIfNeeded));
    orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { orders, transitions: TRANSITIONS };
  });

  add("POST", "/api/admin/orders/:id/status", { perm: "orders:manage" }, async (ctx) => {
    const id = v.id(ctx.params.id);
    const to = v.oneOf(ctx.body.status, "estado", ["preparando", "enviado", "entregado", "cancelado"]);
    if (to === "cancelado" && ctx.user.role !== "admin") {
      await audit(ctx, "authz.denied", { outcome: "denied", target: `order:${id}`, details: { to } });
      throw new HttpError(403, "Solo un administrador puede cancelar pedidos pagados");
    }
    const { order, from } = await transition(id, to, ctx.user.id);
    await audit(ctx, "order.status", { target: `order:${id}`, details: { from, to } });
    return { order };
  });

  // ---- Usuarios ----
  add("GET", "/api/admin/users", { perm: "users:manage" }, async () => {
    const users = (await listJSON("users", "u/")).map((u) => ({ ...publicUser(u), active: u.active, createdAt: u.createdAt }));
    return { users: users.sort((a, b) => a.email.localeCompare(b.email)) };
  });

  add("PUT", "/api/admin/users/:id", { perm: "users:manage" }, async (ctx) => {
    const id = v.id(ctx.params.id);
    if (id === ctx.user.id) throw new HttpError(400, "No puedes modificar tu propio rol o estado");
    const changes = {};
    if (ctx.body.role !== undefined) changes.role = v.oneOf(ctx.body.role, "rol", ROLES);
    if (ctx.body.active !== undefined) changes.active = v.bool(ctx.body.active, "activo");
    const user = await mutateJSON("users", `u/${id}`, (u) => ({ ...u, ...changes }));
    if (!user) throw new HttpError(404, "Usuario no encontrado");
    // Cambio de privilegios => se invalidan sus sesiones activas
    const revoked = await revokeUserSessions(id);
    await audit(ctx, "user.update", { target: `user:${id}`, details: { ...changes, sesionesRevocadas: revoked } });
    return { user: publicUser(user) };
  });

  // ---- Moderacion y auditoria ----
  add("DELETE", "/api/admin/reviews/:productId/:reviewId", { perm: "reviews:moderate" }, async (ctx) => {
    const key = `${v.id(ctx.params.productId)}/${v.id(ctx.params.reviewId)}`;
    const r = await mutateJSON("reviews", key, (x) => ({ ...x, hidden: true }));
    if (!r) throw new HttpError(404, "Reseña no encontrada");
    await audit(ctx, "review.hide", { target: `review:${key}` });
    return { ok: true };
  });

  add("GET", "/api/admin/audit", { perm: "audit:read" }, async (ctx) => {
    const limit = Math.min(300, Math.max(10, Number(ctx.url.searchParams.get("limit")) || 150));
    return { entries: await readAudit(limit) };
  });

  add("GET", "/api/admin/orders/:id", { perm: "orders:manage" }, async (ctx) => {
    const order = await getJSON("orders", v.id(ctx.params.id));
    if (!order) throw new HttpError(404, "Pedido no encontrado");
    return { order };
  });
}
