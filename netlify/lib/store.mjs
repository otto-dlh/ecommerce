// Persistencia sobre Netlify Blobs con consistencia fuerte y escrituras condicionales (ETag).
// mutateJSON implementa control de concurrencia optimista (ASVS v5.0.0-2.3.4, T14).
import { getStore } from "@netlify/blobs";
import { HttpError } from "./http.mjs";

export const store = (name) => getStore({ name, consistency: "strong" });

export const getJSON = (name, key) => store(name).get(key, { type: "json" });

export const putJSON = (name, key, value, opts) => store(name).setJSON(key, value, opts);

export const del = (name, key) => store(name).delete(key);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Lee, transforma y escribe solo si nadie modifico el valor en medio.
 * fn(actual) devuelve el nuevo valor, undefined para no escribir, o lanza para abortar.
 */
export async function mutateJSON(name, key, fn, { create = false, tries = 12 } = {}) {
  const st = store(name);
  for (let i = 0; i < tries; i++) {
    const cur = await st.getWithMetadata(key, { type: "json" });
    if (!cur && !create) return null;
    const next = await fn(cur ? cur.data : null);
    if (next === undefined) return cur ? cur.data : null;
    const res = await st.setJSON(key, next, cur ? { onlyIfMatch: cur.etag } : { onlyIfNew: true });
    if (res.modified) return next;
    await sleep(15 + Math.random() * 60 * (i + 1));
  }
  throw new HttpError(409, "Conflicto de concurrencia. Intenta de nuevo.");
}

// Ninguna clave valida tiene segmentos que empiecen con "." (los ids se validan con [A-Za-z0-9_-]);
// se descartan entradas temporales que algun backend de almacenamiento pudiera listar.
const isValidKey = (k) => !k.split("/").some((seg) => seg.startsWith("."));

export async function listKeys(name, prefix) {
  const { blobs } = await store(name).list(prefix ? { prefix } : {});
  return blobs.map((b) => b.key).filter(isValidKey);
}

export async function listJSON(name, prefix) {
  const st = store(name);
  const keys = await listKeys(name, prefix);
  const out = [];
  for (let i = 0; i < keys.length; i += 25) {
    const chunk = await Promise.all(keys.slice(i, i + 25).map((k) => st.get(k, { type: "json" })));
    out.push(...chunk);
  }
  return out.filter(Boolean);
}
