// Hardening · Cabeceras de seguridad HTTP
export const securityHeaders = {
  id: "Hardening", name: "Cabeceras de seguridad HTTP",
  goal: "Comprobar que el sitio le ordena al navegador bloquear ataques comunes: clickjacking, scripts de terceros, conexiones sin HTTPS y adivinar el tipo de un archivo.",
  steps: [
    ["lab", "Pide la página principal `/` sin caché, como cualquier navegador."],
    ["servidor", "Netlify responde con las cabeceras de `netlify.toml`: HSTS (solo HTTPS durante 2 años), `nosniff`, `X-Frame-Options: DENY` contra clickjacking, `Referrer-Policy` y `Permissions-Policy` (sin cámara, micrófono ni ubicación)."],
    ["servidor", "Suma la CSP estricta que `tooling/vite/csp.mjs` generó en `dist/_headers` al compilar: scripts y estilos solo del propio sitio; imágenes, API y WebSocket solo del origen exacto del proyecto InsForge; `frame-ancestors 'none'`."],
    ["lab", "Revisa que la respuesta traiga las 6 cabeceras."],
    ["navegador", "Con esas reglas se niega a mostrar la tienda dentro de un `<iframe>` ajeno, no ejecuta scripts de otros dominios y no vuelve a conectarse por HTTP."],
  ],
  expect: "`200` con las 6 cabeceras. En `pnpm dev` se omite, porque las cabeceras las aplica Netlify: verifícala con `pnpm serve` o en el sitio desplegado.",
  code: "netlify.toml · tooling/vite/csp.mjs",
  run: async () => {
    // El servidor de desarrollo de Vite no aplica netlify.toml ni puede usar la CSP (recarga en caliente)
    if (import.meta.env.DEV) return { skipped: true, status: "—", detail: "En desarrollo no se aplican las cabeceras: verifícala con pnpm serve o en el sitio desplegado" };
    const r = await fetch("/", { cache: "no-store" });
    const want = ["content-security-policy", "strict-transport-security", "x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy"];
    const missing = want.filter((h) => !r.headers.get(h));
    return { pass: missing.length === 0, status: r.status, detail: missing.length ? `Faltan: ${missing.join(", ")}` : "CSP, HSTS, nosniff, X-Frame-Options, Referrer-Policy y Permissions-Policy presentes" };
  },
};
