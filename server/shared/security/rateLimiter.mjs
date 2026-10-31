// Limitacion de frecuencia por ventana fija (ASVS v5.0.0-2.4.1 / 6.3.1, T01 y T05).
// Las identidades (IP, correo) se guardan como hash; la etiqueta enmascarada solo sirve al panel.
import { TooManyRequestsError } from "../domain/errors.mjs";
import { sha256 } from "./crypto.mjs";

export const BUCKETS = Object.freeze({
  GLOBAL: "global",
  LOGIN_IP: "login-ip",
  LOGIN_FAIL_ACCOUNT: "login-fail-acct",
  LOGIN_FAIL_GLOBAL: "login-fail-global",
  MFA_IP: "mfa-ip",
  REGISTER: "register",
  PASSWORD: "password",
  CHECKOUT: "checkout",
  REVIEW: "review",
  SANDBOX_PAY: "sandbox-pay",
  UPLOAD: "upload",
});

const keyFor = (identity) => sha256(String(identity)).slice(0, 40);
const secondsUntil = (iso) => Math.max(1, Math.ceil((Date.parse(iso) - Date.now()) / 1000));

export function createRateLimiter({ rateLimits, audit }) {
  async function reject(ctx, bucket, retryAfter) {
    await audit.record(ctx, "ratelimit.block", { outcome: "denied", details: { bucket } });
    throw new TooManyRequestsError("Demasiadas solicitudes. Intenta más tarde.", { retryAfter });
  }

  return {
    /** Cuenta la solicitud y la rechaza si se supera el limite de la ventana. */
    async hit(ctx, bucket, identity, limit, windowSec) {
      const result = await rateLimits.hit(bucket, keyFor(identity), { limit, windowSec });
      if (!result.allowed) await reject(ctx, bucket, result.retryAfterSec);
    },

    /** Rechaza si ya se acumularon `limit` fallos en la ventana, sin contar esta solicitud. */
    async assertBelow(ctx, bucket, identity, limit) {
      const window = await rateLimits.peek(bucket, keyFor(identity));
      if (window && Date.parse(window.resetAt) > Date.now() && window.count >= limit) {
        await reject(ctx, bucket, secondsUntil(window.resetAt));
      }
    },

    /** Registra un fallo (p. ej. contrasena incorrecta) en la ventana. */
    recordFailure: (bucket, identity, windowSec, label) => rateLimits.increment(bucket, keyFor(identity), { windowSec, label }),

    /** Ventanas vigentes con al menos `minCount` registros (cuentas bloqueadas, para el panel). */
    listWindows: (bucket, minCount = 1) => rateLimits.list(bucket, { minCount }),

    /** Libera una ventana por su clave ya calculada (desbloqueo manual). */
    clearKey: (bucket, key) => rateLimits.clear(bucket, key),

    /** Libera la ventana de una identidad conocida. */
    clearIdentity: (bucket, identity) => rateLimits.clear(bucket, keyFor(identity)),
  };
}
