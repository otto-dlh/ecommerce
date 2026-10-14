// API REST de la tienda (equivalente serverless de la API Node/Express del documento).
// Orden del pipeline: limite global -> sesion -> CSRF/Origin -> autenticacion -> autorizacion -> validacion -> handler.
import { randomUUID } from "node:crypto";
import { HttpError, parseCookies, readBody, jsonResponse } from "../lib/http.mjs";
import { loadSession, can } from "../lib/auth.mjs";
import { ensureSeed } from "../lib/seed.mjs";
import { rateLimit } from "../lib/ratelimit.mjs";
import { audit } from "../lib/audit.mjs";
import { safeEqual } from "../lib/crypto.mjs";
import authRoutes from "../lib/routes/auth.mjs";
import shopRoutes from "../lib/routes/shop.mjs";
import adminRoutes from "../lib/routes/admin.mjs";
import paymentRoutes from "../lib/routes/payments.mjs";

const routes = [];
function add(method, path, opts, handler) {
  const keys = [];
  const re = new RegExp("^" + path.replace(/:(\w+)/g, (_, k) => (keys.push(k), "([^/]+)")) + "/?$");
  routes.push({ method, re, keys, opts, handler });
}
[authRoutes, shopRoutes, adminRoutes, paymentRoutes].forEach((register) => register(add));

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const extraOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);

function matchRoute(method, pathname) {
  let pathMatched = false;
  for (const r of routes) {
    const m = r.re.exec(pathname);
    if (!m) continue;
    pathMatched = true;
    if (r.method === method) {
      const params = {};
      r.keys.forEach((k, i) => {
        try {
          params[k] = decodeURIComponent(m[i + 1]);
        } catch {
          throw new HttpError(400, "Ruta inválida");
        }
      });
      return { route: r, params };
    }
  }
  throw pathMatched ? new HttpError(405, "Método no permitido") : new HttpError(404, "Recurso no encontrado");
}

/** Proteccion CSRF en capas (ASVS v5.0.0-3.5.1, T13): Origin + Content-Type JSON + token sincronizado. */
async function checkCsrf(ctx) {
  const h = ctx.req.headers;
  const origin = h.get("origin");
  const allowed = [ctx.url.origin, ...extraOrigins];
  const site = h.get("sec-fetch-site");
  if ((origin && !allowed.includes(origin)) || (!origin && site && !["same-origin", "none"].includes(site))) {
    await audit(ctx, "csrf.origin_rejected", { outcome: "denied", details: { origin } });
    throw new HttpError(403, "Origen no permitido");
  }
  // Un formulario HTML entre sitios no puede enviar application/json sin preflight CORS
  if (!(h.get("content-type") || "").toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Content-Type debe ser application/json");
  }
  if (ctx.session && !safeEqual(h.get("x-csrf-token") || "", ctx.session.csrf)) {
    await audit(ctx, "csrf.token_rejected", { outcome: "denied", target: ctx.url.pathname });
    throw new HttpError(403, "Token CSRF inválido o ausente");
  }
}

export default async (req, context) => {
  const url = new URL(req.url);
  const ctx = {
    req, url, ip: context.ip || "0.0.0.0",
    cookies: parseCookies(req.headers.get("cookie")),
    params: {}, body: {}, raw: "", user: null, session: null, status: 200,
    outCookies: [],
    setCookie(c) { this.outCookies.push(c); },
  };
  try {
    await ensureSeed();
    const { route, params } = matchRoute(req.method, url.pathname);
    ctx.params = params;
    await rateLimit(ctx, "global", ctx.ip, 300, 60);
    await loadSession(ctx);

    if (!SAFE_METHODS.has(req.method)) {
      if (!route.opts.webhook) await checkCsrf(ctx);
      const { raw, body } = await readBody(req);
      ctx.raw = raw;
      ctx.body = body;
    }

    if ((route.opts.auth || route.opts.perm) && !ctx.user) throw new HttpError(401, "Debes iniciar sesión");
    if (route.opts.perm && !can(ctx.user, route.opts.perm)) {
      await audit(ctx, "authz.denied", { outcome: "denied", target: url.pathname, details: { perm: route.opts.perm } });
      throw new HttpError(403, "No tienes permiso para esta operación");
    }
    if (route.opts.perm && ctx.user.role === "admin" && process.env.REQUIRE_ADMIN_MFA === "true" && !ctx.user.mfa?.enabled) {
      throw new HttpError(403, "Activa MFA en tu cuenta para usar el panel de administración");
    }

    const body = await route.handler(ctx);
    return jsonResponse(ctx.status, body, {}, ctx.outCookies);
  } catch (err) {
    if (err instanceof HttpError) {
      const headers = err.extra?.retryAfter ? { "retry-after": String(err.extra.retryAfter) } : {};
      return jsonResponse(err.status, { error: err.message, ...err.extra }, headers, ctx.outCookies);
    }
    // Errores genericos al cliente; el detalle queda solo en el log del servidor (ASVS v5.0.0-16.5.1)
    const ref = randomUUID().slice(0, 8);
    console.error(JSON.stringify({ type: "unhandled_error", ref, path: url.pathname, message: err?.message, stack: err?.stack }));
    return jsonResponse(500, { error: "Ocurrió un error interno", ref }, {}, ctx.outCookies);
  }
};

export const config = { path: "/api/*" };
