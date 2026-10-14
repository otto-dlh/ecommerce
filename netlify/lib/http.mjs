// Utilidades HTTP comunes: errores controlados, cookies y lectura segura del cuerpo.

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function parseCookies(header) {
  const out = {};
  for (const part of (header || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 1) continue;
    const name = part.slice(0, i).trim();
    try {
      out[name] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      // cookie malformada: se ignora
    }
  }
  return out;
}

// Cookie de sesion: HttpOnly + SameSite=Strict + Secure (ASVS v5.0.0-3.3.4, T13)
export function sessionCookie(name, value, maxAgeSec, secure) {
  return [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    secure ? "Secure" : null,
    `Max-Age=${maxAgeSec}`,
  ]
    .filter(Boolean)
    .join("; ");
}

const MAX_BODY = 16 * 1024;

export async function readBody(req) {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_BODY) throw new HttpError(413, "Solicitud demasiado grande");
  const raw = await req.text();
  if (Buffer.byteLength(raw) > MAX_BODY) throw new HttpError(413, "Solicitud demasiado grande");
  if (!raw) return { raw, body: {} };
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new HttpError(400, "JSON inválido");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Se esperaba un objeto JSON");
  }
  return { raw, body };
}

export function jsonResponse(status, body, extraHeaders = {}, cookies = []) {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    // Evita que caches intermedias guarden datos sensibles (ASVS v5.0.0-14.2.2)
    "cache-control": "no-store",
    pragma: "no-cache",
    "x-content-type-options": "nosniff",
    ...extraHeaders,
  });
  for (const c of cookies) headers.append("set-cookie", c);
  return new Response(JSON.stringify(body), { status, headers });
}
