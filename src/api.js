// Cliente HTTP: cookies de sesion HttpOnly (el JS nunca ve el token) + cabecera anti-CSRF.
let csrfToken = null;

// Las escrituras esperan a que /api/auth/me diga si hay sesion (y entregue su token CSRF):
// sin esto, una pantalla que escribe al montarse (p. ej. la cotizacion del carrito) sale sin token.
let markSessionKnown;
const sessionKnown = new Promise((resolve) => { markSessionKnown = resolve; });

export const setCsrf = (t) => {
  csrfToken = t || null;
  markSessionKnown();
};

export async function request(path, { method = "GET", body, csrf = true, headers = {} } = {}) {
  const init = { method, credentials: "same-origin", headers: { Accept: "application/json", ...headers } };
  if (method !== "GET") {
    if (csrf) await sessionKnown;
    // Archivos (Blob/File) viajan tal cual con su tipo; todo lo demas como JSON
    const isFile = body instanceof Blob;
    init.headers["Content-Type"] ??= isFile ? body.type : "application/json";
    if (csrf && csrfToken) init.headers["X-CSRF-Token"] = csrfToken;
    init.body = typeof body === "string" || isFile ? body : JSON.stringify(body ?? {});
  }
  const res = await fetch(path, init);
  let data = {};
  try {
    data = await res.json();
  } catch {
    // respuesta sin JSON
  }
  return { ok: res.ok, status: res.status, data, headers: res.headers };
}

export async function api(path, opts) {
  const r = await request(path, opts);
  if (!r.ok) {
    const err = new Error(r.data.error || `Error ${r.status}`);
    err.status = r.status;
    err.data = r.data;
    throw err;
  }
  return r.data;
}
