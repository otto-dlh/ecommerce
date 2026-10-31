// Raiz de composicion: el UNICO lugar que decide que proveedor de datos se usa.
// Agregar otra base de datos = escribir su adaptador y registrarlo en PROVIDERS.
// Cambiar de endpoint = cambiar variables de entorno (p. ej. INSFORGE_URL), sin tocar codigo.
import { loadConfig } from "../config.mjs";
import { assertImplementsPorts } from "./ports.mjs";
import { createKeyring } from "../shared/security/keyring.mjs";
import { createEventBus } from "../shared/events/eventBus.mjs";
import { createServices } from "./services.mjs";
import { seedInitialData } from "./seedData.mjs";

const PROVIDERS = {
  // Persistente: PostgreSQL, Storage y Realtime de InsForge
  insforge: {
    load: async (config) => (await import("../infra/insforge/index.mjs")).createInsforgeAdapters(config.insforge),
    seedOnStart: false,
    // Base de datos real: nunca cuentas con contrasenas conocidas
    demoAccounts: false,
  },
  // Efimero: arranca vacio en cada instancia, por eso se siembra al iniciar
  memory: {
    load: async () => (await import("../infra/memory/index.mjs")).createMemoryAdapters(),
    seedOnStart: true,
    demoAccounts: true,
  },
};

/**
 * @param {Record<string, string|undefined>} [env]   variables de entorno (por defecto las del proceso); las valida loadConfig
 * @param {{ logger?: Console, seed?: boolean, hashPassword?: (p: string) => Promise<string> }} [options]
 */
export async function createContainer(env, { logger = console, seed, hashPassword } = {}) {
  const config = loadConfig(env);
  const provider = PROVIDERS[config.dataProvider];

  const keyring = createKeyring(config.appSecret);
  const repos = assertImplementsPorts(await provider.load(config), config.dataProvider);
  const events = createEventBus({ logger });
  const services = createServices({ repos, keyring, events, logger });
  if (seed ?? provider.seedOnStart) {
    await seedInitialData(repos, { adminPassword: config.seedAdminPassword, demoAccounts: provider.demoAccounts, ...(hashPassword && { hash: hashPassword }) });
  }
  return { config, providerName: config.dataProvider, repos, events, services, keyring };
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
