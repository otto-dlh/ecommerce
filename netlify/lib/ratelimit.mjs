// Limitacion de tasa por ventana fija (ASVS v5.0.0-2.4.1 / 6.3.1, T01 y T05).
import { getJSON, mutateJSON } from "./store.mjs";
import { sha256 } from "./crypto.mjs";
import { HttpError } from "./http.mjs";
import { audit } from "./audit.mjs";

const keyFor = (bucket, identity) => `${bucket}/${sha256(String(identity)).slice(0, 40)}`;

async function blocked(ctx, bucket, retryAfter) {
  await audit(ctx, "ratelimit.block", { outcome: "denied", details: { bucket } });
  throw new HttpError(429, "Demasiadas solicitudes. Intenta más tarde.", { retryAfter });
}

/** Cuenta la solicitud y la rechaza si se supera el limite de la ventana. */
export async function rateLimit(ctx, bucket, identity, limit, windowSec) {
  let retryAfter = 0;
  await mutateJSON(
    "ratelimit",
    keyFor(bucket, identity),
    (cur) => {
      retryAfter = 0;
      const now = Date.now();
      if (!cur || cur.reset <= now) return { count: 1, reset: now + windowSec * 1000 };
      if (cur.count >= limit) {
        retryAfter = Math.ceil((cur.reset - now) / 1000);
        return undefined;
      }
      return { ...cur, count: cur.count + 1 };
    },
    { create: true }
  );
  if (retryAfter) await blocked(ctx, bucket, retryAfter);
}

/** Rechaza si ya se acumularon `limit` fallos en la ventana, sin contar esta solicitud. */
export async function assertBelowLimit(ctx, bucket, identity, limit) {
  const cur = await getJSON("ratelimit", keyFor(bucket, identity));
  const now = Date.now();
  if (cur && cur.reset > now && cur.count >= limit) await blocked(ctx, bucket, Math.ceil((cur.reset - now) / 1000));
}

/** Registra un fallo (p. ej. contrasena incorrecta) en la ventana. */
export async function recordFailure(bucket, identity, windowSec) {
  await mutateJSON(
    "ratelimit",
    keyFor(bucket, identity),
    (cur) => {
      const now = Date.now();
      if (!cur || cur.reset <= now) return { count: 1, reset: now + windowSec * 1000 };
      return { ...cur, count: cur.count + 1 };
    },
    { create: true }
  );
}
