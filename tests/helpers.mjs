// Utilidades compartidas por las pruebas: contenedor en memoria, contextos y sesiones de prueba.
import { createContainer } from "../netlify/lib/infra/container.mjs";
import { hashPassword } from "../netlify/lib/security/crypto.mjs";

export const TEST_SECRET = "secreto-de-pruebas-".padEnd(48, "x");

export const DEMO = Object.freeze({
  admin: ["admin@tienda.test", "Admin#Demo2026!"],
  operador: ["operador@tienda.test", "Operador#Demo2026!"],
  auditor: ["auditor@tienda.test", "Auditor#Demo2026!"],
  cliente: ["cliente@tienda.test", "Cliente#Demo2026!"],
  cliente2: ["cliente2@tienda.test", "Cliente2#Demo2026!"],
});

const silentLogger = { log() {}, error() {}, warn() {} };

// scrypt es costoso a proposito: se calcula una vez por contrasena y se reutiliza entre contenedores
const hashes = new Map();
const cachedHash = (password) => {
  if (!hashes.has(password)) hashes.set(password, hashPassword(password));
  return hashes.get(password);
};

/** Contenedor nuevo con el proveedor en memoria y los datos demo sembrados. */
export const newContainer = () =>
  createContainer({ DATA_PROVIDER: "memory", APP_SECRET: TEST_SECRET }, { logger: silentLogger, hashPassword: cachedHash });

let ipSeq = 0;
/** Contexto anonimo con una IP distinta en cada llamada (los limites por IP no se mezclan entre pruebas). */
export const anonCtx = (ip = `10.0.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`) => ({ user: null, session: null, ip, userAgent: "node-test" });

/** Inicia sesion y devuelve un contexto autenticado listo para llamar casos de uso. */
export async function loginAs(container, who, base = anonCtx()) {
  const [email, password] = DEMO[who];
  const result = await container.services.auth.login(base, { email, password });
  const { user, session } = await container.services.sessions.resolve(result.sessionToken);
  return { ...base, user, session, token: result.sessionToken };
}

/** Eventos emitidos durante la prueba (para verificar notificaciones). */
export function captureEvents(container) {
  const seen = [];
  container.events.on("*", (payload, event) => seen.push({ event, payload }));
  return seen;
}
