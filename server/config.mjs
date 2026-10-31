// Configuracion del servidor: el UNICO lugar que lee variables de entorno.
// Se valida completa al arrancar y falla cerrado: el error nombra cada variable con problemas, nunca su valor
// (los logs de las funciones no deben contener secretos). Cambiar de endpoint o de proveedor = cambiar variables.

export const DATA_PROVIDERS = Object.freeze(["insforge", "memory"]);
export const DEFAULT_DATA_PROVIDER = "insforge";
export const MIN_APP_SECRET_LENGTH = 32;
const DEFAULT_IMAGE_BUCKET = "product-images";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

export class ConfigError extends Error {}

/** Origen normalizado (https, o http solo en local) o null si el valor no es una URL valida. */
function serviceOrigin(value) {
  try {
    const url = new URL(String(value ?? "").trim());
    const secure = url.protocol === "https:" || (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname));
    return secure ? url.origin : null;
  } catch {
    return null;
  }
}

const parseList = (value) => String(value ?? "").split(",").map((item) => item.trim()).filter(Boolean);

function insforgeSettings(env, problems) {
  const url = serviceOrigin(env.INSFORGE_URL);
  if (!url) problems.push("INSFORGE_URL debe ser la URL https del proyecto InsForge");
  if (!env.INSFORGE_API_KEY) problems.push("INSFORGE_API_KEY es obligatoria con DATA_PROVIDER=insforge");
  return Object.freeze({ url, apiKey: env.INSFORGE_API_KEY, imageBucket: env.INSFORGE_IMAGE_BUCKET || DEFAULT_IMAGE_BUCKET });
}

/**
 * @param {Record<string, string|undefined>} [env]
 * @returns {Readonly<{ dataProvider: string, appSecret: string, insforge: Readonly<{ url: string, apiKey: string, imageBucket: string }>|null,
 *                      allowedOrigins: readonly string[], seedAdminPassword: string|null }>}
 */
export function loadConfig(env = process.env) {
  const problems = [];

  const dataProvider = env.DATA_PROVIDER || DEFAULT_DATA_PROVIDER;
  if (!DATA_PROVIDERS.includes(dataProvider)) problems.push(`DATA_PROVIDER debe ser uno de: ${DATA_PROVIDERS.join(", ")}`);

  const appSecret = env.APP_SECRET ?? "";
  if (appSecret.length < MIN_APP_SECRET_LENGTH) problems.push(`APP_SECRET es obligatorio y debe tener al menos ${MIN_APP_SECRET_LENGTH} caracteres`);

  const insforge = dataProvider === "insforge" ? insforgeSettings(env, problems) : null;

  // Origenes extra permitidos por el control CSRF (p. ej. un dominio propio ademas del de Netlify)
  const allowedOrigins = parseList(env.ALLOWED_ORIGINS);
  if (allowedOrigins.some((origin) => serviceOrigin(origin) !== origin)) {
    problems.push("ALLOWED_ORIGINS solo admite orígenes completos (https://dominio), separados por coma");
  }

  if (problems.length) throw new ConfigError(`Configuración inválida del servidor: ${problems.join("; ")}`);
  return Object.freeze({
    dataProvider,
    appSecret,
    insforge,
    allowedOrigins: Object.freeze(allowedOrigins),
    seedAdminPassword: env.SEED_PASSWORD_ADMIN || null,
  });
}
