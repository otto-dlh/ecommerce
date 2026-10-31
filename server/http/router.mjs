// Enrutador minimo: metodo + ruta con parametros (:id) → controlador y sus opciones de seguridad.
import { HttpError } from "./http.mjs";

/**
 * @typedef {object} RouteOptions
 * @property {boolean} [auth]                    exige sesion
 * @property {string} [perm]                     exige un permiso del dominio (implica sesion)
 * @property {boolean} [webhook]                 llamada servidor a servidor: sin CSRF ni sesion (se autentica por firma)
 * @property {boolean} [passwordChangeExempt]    disponible aunque la cuenta deba cambiar su contrasena
 * @property {number} [maxBodyBytes]             limite de cuerpo propio (por defecto 16 KB)
 * @property {boolean} [rawBody]                 cuerpo binario en ctx.bytes en vez de JSON
 * @property {string[]} [contentTypes]           tipos de contenido aceptados (por defecto application/json)
 */

export function createRouter() {
  const routes = [];

  /** @param {string} method @param {string} path @param {RouteOptions} options @param {(ctx: object) => Promise<object>|object} handler */
  function add(method, path, options, handler) {
    const keys = [];
    const pattern = new RegExp("^" + path.replace(/:(\w+)/g, (_, key) => (keys.push(key), "([^/]+)")) + "/?$");
    routes.push({ method, pattern, keys, options, handler });
  }

  function match(method, pathname) {
    let pathExists = false;
    for (const route of routes) {
      const found = route.pattern.exec(pathname);
      if (!found) continue;
      pathExists = true;
      if (route.method !== method) continue;
      const params = {};
      route.keys.forEach((key, i) => {
        try {
          params[key] = decodeURIComponent(found[i + 1]);
        } catch {
          throw new HttpError(400, "Ruta inválida");
        }
      });
      return { route, params };
    }
    throw pathExists ? new HttpError(405, "Método no permitido") : new HttpError(404, "Recurso no encontrado");
  }

  return { add, match };
}
