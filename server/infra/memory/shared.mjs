// Infraestructura compartida en memoria: limites de frecuencia y archivos.

export function createRateLimitStore() {
  const rows = new Map();
  const id = (bucket, key) => `${bucket}/${key}`;
  const live = (bucket, key, now = Date.now()) => {
    const w = rows.get(id(bucket, key));
    return w && w.resetAt > now ? w : null;
  };
  const view = (key, w) => ({ key, count: w.count, resetAt: new Date(w.resetAt).toISOString(), label: w.label ?? null });
  const start = (bucket, key, windowSec, label) => {
    const w = { bucket, key, count: 1, resetAt: Date.now() + windowSec * 1000, label: label ?? null };
    rows.set(id(bucket, key), w);
    return w;
  };
  return {
    async hit(bucket, key, { limit, windowSec, label }) {
      const w = live(bucket, key);
      if (!w) return { allowed: true, count: start(bucket, key, windowSec, label).count, retryAfterSec: 0 };
      if (w.count >= limit) return { allowed: false, count: w.count, retryAfterSec: Math.max(1, Math.ceil((w.resetAt - Date.now()) / 1000)) };
      w.count++;
      return { allowed: true, count: w.count, retryAfterSec: 0 };
    },
    async peek(bucket, key) { const w = live(bucket, key); return w ? view(key, w) : null; },
    async increment(bucket, key, { windowSec, label }) {
      const w = live(bucket, key);
      if (!w) return start(bucket, key, windowSec, label).count;
      w.count++;
      if (label) w.label = label;
      return w.count;
    },
    async clear(bucket, key) { rows.delete(id(bucket, key)); },
    async list(bucket, { minCount = 1 } = {}) {
      const now = Date.now();
      return [...rows.values()].filter((w) => w.bucket === bucket && w.resetAt > now && w.count >= minCount).map((w) => view(w.key, w));
    },
  };
}

export function createFileStorage() {
  const files = new Map();
  return {
    async put(key, bytes, contentType) {
      files.set(key, { bytes, contentType });
      return { key, url: `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}` };
    },
    async remove(key) { files.delete(key); },
  };
}
