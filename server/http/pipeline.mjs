// Pipeline de seguridad de la API (equivalente serverless de un middleware Express).
// Orden: limite global → sesion → CSRF/Origin → cuerpo → autenticacion → autorizacion → controlador.
import { randomUUID } from "node:crypto";
import { ForbiddenError, UnauthenticatedError } from "../shared/domain/errors.mjs";
import { can, needsMfaForPanel } from "../modules/identity/index.mjs";
import { BUCKETS } from "../shared/security/rateLimiter.mjs";
import { parseCookies, readJsonBody, readBinaryBody, jsonResponse, sessionCookie } from "./http.mjs";
import { toHttpError, headersFor } from "./errorMapper.mjs";
import { assertCsrfSafe } from "./csrf.mjs";
import { createRouter } from "./router.mjs";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const GLOBAL_LIMIT = { requests: 300, windowSec: 60 };


function createContext(req, context, url) {
  const secure = url.protocol === "https:";
  const cookieName = secure ? "__Host-sid" : "sid";
  const outCookies = [];
  const ctx = {
    req, url,
    ip: context?.ip || "0.0.0.0",
    userAgent: req.headers.get("user-agent") || "",
    cookies: parseCookies(req.headers.get("cookie")),
    query: url.searchParams,
    params: {}, body: {}, raw: "",
    user: null, session: null, policy: null,
    status: 200,
    outCookies,
    setCookie: (cookie) => outCookies.push(cookie),
    /** Pone la cookie de la sesion recien creada y devuelve solo los datos seguros para el navegador. */
    startSession(result) {
      ctx.setCookie(sessionCookie(cookieName, result.sessionToken, ctx.policy.sessionMaxHours * 3600, secure));
      return { user: result.user, csrf: result.csrf, realtimeChannel: result.realtimeChannel };
    },
    endSession: () => ctx.setCookie(sessionCookie(cookieName, "", 0, secure)),
    sessionToken: () => ctx.cookies[cookieName],
  };
  return ctx;
}

async function authenticate(ctx, sessions) {
  const token = ctx.sessionToken();
  if (!token) return;
  const resolved = await sessions.resolve(token);
  if (!resolved) return ctx.endSession();
  ctx.user = resolved.user;
  ctx.session = resolved.session;
}

async function authorize(ctx, options, audit) {
  const needsSession = options.auth || options.perm;
  if (needsSession && !ctx.user) throw new UnauthenticatedError("Debes iniciar sesión");
  if (needsSession && ctx.user.mustChangePassword && !options.passwordChangeExempt) {
    throw new ForbiddenError("Debes cambiar tu contraseña antes de continuar", { code: "password_change_required" });
  }
  if (!options.perm) return;
  if (!can(ctx.user, options.perm)) {
    await audit.record(ctx, "authz.denied", { outcome: "denied", target: ctx.url.pathname, details: { perm: options.perm } });
    throw new ForbiddenError("No tienes permiso para esta operación");
  }
  if (needsMfaForPanel(ctx.user, ctx.policy)) {
    throw new ForbiddenError("Activa MFA en tu cuenta para usar el panel de administración", { code: "mfa_required" });
  }
}

function errorResponse(err, ctx) {
  const httpError = toHttpError(err);
  if (httpError) return jsonResponse(httpError.status, { error: httpError.message, ...httpError.extra }, headersFor(httpError), ctx.outCookies);
  // Errores inesperados: mensaje generico al cliente; el detalle queda solo en el log del servidor (ASVS v5.0.0-16.5.1)
  const ref = randomUUID().slice(0, 8);
  console.error(JSON.stringify({ type: "unhandled_error", ref, path: ctx.url.pathname, message: err?.message, stack: err?.stack }));
  return jsonResponse(500, { error: "Ocurrió un error interno", ref }, {}, ctx.outCookies);
}

/**
 * @param {() => Promise<{ services: object }>} getContainer
 * @param {(router: ReturnType<typeof createRouter>, services: object) => void} registerRoutes
 */
export function createApiHandler(getContainer, registerRoutes) {
  let router;

  return async function handle(req, context) {
    const url = new URL(req.url);
    const ctx = createContext(req, context, url);
    try {
      const { services, config } = await getContainer();
      if (!router) {
        router = createRouter();
        registerRoutes(router, services);
      }
      const { route, params } = router.match(req.method, url.pathname);
      ctx.params = params;
      await services.rateLimiter.hit(ctx, BUCKETS.GLOBAL, ctx.ip, GLOBAL_LIMIT.requests, GLOBAL_LIMIT.windowSec);
      ctx.policy = await services.policy.get();
      await authenticate(ctx, services.sessions);

      if (!SAFE_METHODS.has(req.method)) {
        if (!route.options.webhook) await assertCsrfSafe(ctx, services.audit, config.allowedOrigins, route.options.contentTypes);
        if (route.options.rawBody) ctx.bytes = await readBinaryBody(req, route.options.maxBodyBytes);
        else Object.assign(ctx, await readJsonBody(req, route.options.maxBodyBytes));
      }
      await authorize(ctx, route.options, services.audit);

      const body = await route.handler(ctx);
      return jsonResponse(ctx.status, body, {}, ctx.outCookies);
    } catch (err) {
      return errorResponse(err, ctx);
    }
  };
}
