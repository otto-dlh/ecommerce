// Raiz de composicion: el UNICO lugar que decide que proveedor de datos se usa.
// Agregar otra base de datos = escribir su adaptador y registrarlo en PROVIDERS.
// Cambiar de endpoint = cambiar variables de entorno (p. ej. INSFORGE_URL), sin tocar codigo.
import { assertImplementsPorts } from "../ports/index.mjs";
import { createKeyring } from "../security/keyring.mjs";
import { createEventBus } from "../application/eventBus.mjs";
import { createServices } from "../application/index.mjs";
import { seedDemoData } from "../application/seedDemoData.mjs";

const PROVIDERS = {
  // Persistente: PostgreSQL, Storage y Realtime de InsForge
  insforge: {
    load: async (env) => (await import("./insforge/index.mjs")).createInsforgeAdapters(env),
    seedOnStart: false,
  },
  // Efimero: arranca vacio en cada instancia, por eso se siembra al iniciar
  memory: {
    load: async () => (await import("./memory/index.mjs")).createMemoryAdapters(),
    seedOnStart: true,
  },
};

export const DEFAULT_PROVIDER = "insforge";

/**
 * @param {Record<string, string|undefined>} env
 * @param {{ logger?: Console, seed?: boolean, hashPassword?: (p: string) => Promise<string> }} [options]
 */
export async function createContainer(env = process.env, { logger = console, seed, hashPassword } = {}) {
  const providerName = env.DATA_PROVIDER || DEFAULT_PROVIDER;
  const provider = PROVIDERS[providerName];
  if (!provider) throw new Error(`DATA_PROVIDER desconocido: "${providerName}". Opciones: ${Object.keys(PROVIDERS).join(", ")}`);

  const keyring = createKeyring(env.APP_SECRET);
  const repos = assertImplementsPorts(await provider.load(env), providerName);
  const events = createEventBus({ logger });
  const services = createServices({ repos, keyring, events, logger });
  if (seed ?? provider.seedOnStart) await seedDemoData(repos, env, hashPassword ? { hash: hashPassword } : undefined);
  return { providerName, repos, events, services, keyring };
}

let shared;
/** Contenedor compartido por instancia de funcion (se crea en la primera solicitud). */
export function getContainer() {
  shared ??= createContainer().catch((err) => {
    shared = undefined;
    throw err;
  });
  return shared;
}
