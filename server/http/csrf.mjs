// Proteccion CSRF en capas (ASVS v5.0.0-3.5.1, T13): Origin/Sec-Fetch-Site + tipo de contenido + token sincronizado.
import { safeEqual } from "../shared/security/crypto.mjs";
import { HttpError } from "./http.mjs";

const SAME_SITE_VALUES = ["same-origin", "none"];
const JSON_TYPE = "application/json";

function assertTrustedOrigin(ctx, allowedOrigins) {
  const origin = ctx.req.headers.get("origin");
  const site = ctx.req.headers.get("sec-fetch-site");
  const foreignOrigin = origin && !allowedOrigins.includes(origin);
  const foreignSite = !origin && site && !SAME_SITE_VALUES.includes(site);
  return foreignOrigin || foreignSite ? origin ?? site : null;
}

/**
 * @param {object} ctx            contexto de la solicitud (req, url, session)
 * @param {object} audit          servicio de auditoria
 * @param {string[]} extraOrigins origenes adicionales permitidos (ALLOWED_ORIGINS)
 * @param {string[]} [contentTypes] tipos aceptados (por defecto solo JSON)
 */
export async function assertCsrfSafe(ctx, audit, extraOrigins, contentTypes = [JSON_TYPE]) {
  const rejectedOrigin = assertTrustedOrigin(ctx, [ctx.url.origin, ...extraOrigins]);
  if (rejectedOrigin) {
    await audit.record(ctx, "csrf.origin_rejected", { outcome: "denied", details: { origin: rejectedOrigin } });
    throw new HttpError(403, "Origen no permitido");
  }
  // Un formulario HTML entre sitios no puede enviar application/json sin preflight CORS
  const type = (ctx.req.headers.get("content-type") || "").toLowerCase();
  if (!contentTypes.some((allowed) => type.startsWith(allowed))) {
    throw new HttpError(415, `Content-Type debe ser ${contentTypes.join(" o ")}`);
  }
  if (ctx.session && !safeEqual(ctx.req.headers.get("x-csrf-token") || "", ctx.session.csrf)) {
    await audit.record(ctx, "csrf.token_rejected", { outcome: "denied", target: ctx.url.pathname });
    throw new HttpError(403, "Token CSRF inválido o ausente");
  }
}
