// Plugin de Vite solo para desarrollo: ejecuta las funciones de netlify/functions dentro del
// servidor de Vite, respetando el `config.path` que declara cada una.
// Motivo: el proxy de `netlify dev` reintenta toda respuesta 403/404 con variantes `.html`
// (imita al CDN), lo que altera los codigos HTTP de la API y vuelve a ejecutar la solicitud.
// Las funciones son manejadores web estandar (Request → Response), asi que no hace falta el CLI.
import { readdirSync } from "node:fs";
import { Readable } from "node:stream";
import { loadEnv } from "vite";

const FUNCTIONS_DIR = "netlify/functions";
const BODYLESS_METHODS = new Set(["GET", "HEAD"]);

/** "/api/*" → coincide con /api/... ; "/sandbox/pay" → coincidencia exacta. */
const matcherFor = (path) => (path.endsWith("/*") ? (url) => url.startsWith(path.slice(0, -1)) : (url) => url === path);

function toWebRequest(req, origin) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  const hasBody = !BODYLESS_METHODS.has(req.method);
  return new Request(new URL(req.url, origin), { method: req.method, headers, body: hasBody ? Readable.toWeb(req) : undefined, duplex: "half" });
}

async function sendWebResponse(res, response) {
  const headers = {};
  response.headers.forEach((value, name) => {
    if (name !== "set-cookie") headers[name] = value;
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) headers["set-cookie"] = cookies;
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
}

export function localNetlifyFunctions() {
  let routes = [];
  return {
    name: "local-netlify-functions",
    apply: "serve",
    async configureServer(server) {
      // Variables del servidor (las funciones las leen de process.env, como en Netlify)
      Object.assign(process.env, loadEnv(server.config.mode, server.config.root, ""));
      const files = readdirSync(FUNCTIONS_DIR).filter((file) => file.endsWith(".mjs"));
      routes = await Promise.all(
        files.map(async (file) => {
          const module = `/${FUNCTIONS_DIR}/${file}`;
          const { config } = await server.ssrLoadModule(module);
          return { module, matches: matcherFor(config.path) };
        }),
      );

      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url.split("?")[0];
        const route = routes.find((r) => r.matches(pathname));
        if (!route) return next();
        try {
          // ssrLoadModule recarga la funcion cuando cambia su codigo
          const { default: handler } = await server.ssrLoadModule(route.module);
          const origin = `http://${req.headers.host}`;
          await sendWebResponse(res, await handler(toWebRequest(req, origin), { ip: req.socket.remoteAddress }));
        } catch (err) {
          next(err);
        }
      });
    },
  };
}
