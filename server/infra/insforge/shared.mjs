// Infraestructura compartida sobre InsForge: limites de frecuencia y almacenamiento de archivos.
import { toIso } from "./db.mjs";

const MAX_INT = 2_147_483_647;

const windowFromRow = (row) => row && { key: row.key, count: row.count, resetAt: toIso(row.reset_at), label: row.label };

export function createRateLimitStore(db) {
  const limits = () => db.from("rate_limits");
  const hit = async (bucket, key, limit, windowSec, label) => {
    const [row] = await db.rpc("rate_hit", { p_bucket: bucket, p_key: key, p_limit: limit, p_window_sec: windowSec, p_label: label ?? null });
    return row;
  };
  return {
    async hit(bucket, key, { limit, windowSec, label }) {
      const row = await hit(bucket, key, limit, windowSec, label);
      return { allowed: row.allowed, count: row.hits, retryAfterSec: row.retry_after_sec };
    },
    async peek(bucket, key) {
      const now = new Date().toISOString();
      return windowFromRow(await db.run(limits().select("*").eq("bucket", bucket).eq("key", key).gt("reset_at", now).maybeSingle()));
    },
    async increment(bucket, key, { windowSec, label }) { return (await hit(bucket, key, MAX_INT, windowSec, label)).hits; },
    async clear(bucket, key) { await db.run(limits().delete().eq("bucket", bucket).eq("key", key)); },
    async list(bucket, { minCount = 1 } = {}) {
      const now = new Date().toISOString();
      const rows = await db.run(limits().select("*").eq("bucket", bucket).gt("reset_at", now).gte("count", minCount).order("reset_at", { ascending: false }));
      return rows.map(windowFromRow);
    },
  };
}

/** Archivos publicos (fotos de producto) en un bucket de InsForge Storage. */
export function createFileStorage(db, bucket) {
  const files = () => db.storage.from(bucket);
  return {
    async put(key, bytes, contentType) {
      const data = await db.run(files().upload(key, new Blob([bytes], { type: contentType })));
      return { key: data.key, url: data.url };
    },
    async remove(key) { await db.run(files().remove(key)); },
  };
}
