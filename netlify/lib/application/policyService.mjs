// Politica de acceso vigente. Se cachea unos segundos por instancia para no leerla en cada solicitud;
// un cambio se aplica en todas las instancias como maximo tras CACHE_MS.
import { DEFAULT_POLICY, parsePolicyChanges } from "../domain/accessPolicy.mjs";

const CACHE_MS = 30_000;

export function createPolicyService({ policyStore, audit, events }) {
  let cached = null;
  let cachedAt = 0;

  async function get() {
    if (!cached || Date.now() - cachedAt > CACHE_MS) {
      cached = { ...DEFAULT_POLICY, ...(await policyStore.get()) };
      cachedAt = Date.now();
    }
    return cached;
  }

  async function update(ctx, body) {
    const changes = parsePolicyChanges(body);
    const before = await get();
    cached = { ...DEFAULT_POLICY, ...(await policyStore.update(changes)) };
    cachedAt = Date.now();
    const previous = Object.fromEntries(Object.keys(changes).map((key) => [key, before[key]]));
    await audit.record(ctx, "access.policy_update", { target: "policy", details: { antes: previous, despues: changes } });
    await events.emit("access.changed", { kind: "policy" });
    return cached;
  }

  return { get, update };
}
