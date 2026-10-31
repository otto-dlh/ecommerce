// T13 · Cookie de sesión inaccesible desde JavaScript
export const httpOnlyCookie = {
  id: "T13", name: "Cookie de sesión inaccesible desde JavaScript",
  goal: "Robar la sesión con un script inyectado que lea `document.cookie` y se la envíe al atacante.",
  steps: [
    ["servidor", "Antes, al iniciar sesión, el servidor creó la cookie con `HttpOnly` y `SameSite=Strict` (y en HTTPS, `Secure` y el prefijo `__Host-`). El token es aleatorio de 256 bits y en el servidor solo se guarda su hash SHA-256."],
    ["atacante", "Un script en la página, como el que dejaría un XSS, lee `document.cookie` buscando la sesión (`__Host-sid` en HTTPS, `sid` en local)."],
    ["navegador", "Como la cookie es `HttpOnly`, no la incluye en `document.cookie`: el script no encuentra nada que robar."],
    ["navegador", "La cookie sigue viajando en cada petición a la tienda, así que la sesión funciona con normalidad."],
  ],
  expect: "La cookie no aparece en `document.cookie`. Es una comprobación en el navegador, sin petición HTTP.",
  code: "server/http/http.mjs · server/modules/identity/application/sessionService.mjs",
  run: async ({ user }) => {
    const visible = /(^|;\s*)(__Host-)?sid=/.test(document.cookie);
    return { pass: !visible, status: "—", detail: visible ? "¡La cookie es legible!" : `document.cookie no expone la sesión (HttpOnly)${user ? "" : " — inicia sesión para una prueba completa"}` };
  },
};
