// Secretos de la aplicacion (ASVS v5.0.0-13.3.1, T10).
// APP_SECRET es obligatorio: sin el, la aplicacion no arranca (falla cerrado).
// Cada uso tiene su propia clave derivada: filtrar una no compromete las demas.
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { hmacHex, safeEqual } from "./crypto.mjs";

const MIN_SECRET_LENGTH = 32;
const CIPHER = "aes-256-gcm";
const FORMAT_VERSION = "v1";

export function createKeyring(appSecret) {
  if (typeof appSecret !== "string" || appSecret.length < MIN_SECRET_LENGTH) {
    throw new Error(`APP_SECRET es obligatorio y debe tener al menos ${MIN_SECRET_LENGTH} caracteres`);
  }
  const derived = new Map();

  /** Clave de 32 bytes exclusiva de un proposito ("audit", "webhook", "mfa"...). */
  function subkey(purpose) {
    if (!derived.has(purpose)) derived.set(purpose, createHmac("sha256", appSecret).update(`tienda-segura:${purpose}`).digest());
    return derived.get(purpose);
  }

  return {
    subkey,
    sign: (purpose, data) => hmacHex(subkey(purpose), data),
    verify: (purpose, data, mac) => safeEqual(mac, hmacHex(subkey(purpose), data)),

    /** Cifrado autenticado para secretos en reposo (p. ej. semillas TOTP). */
    encrypt(purpose, plaintext) {
      const iv = randomBytes(12);
      const cipher = createCipheriv(CIPHER, subkey(purpose), iv);
      const data = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
      return [FORMAT_VERSION, iv, cipher.getAuthTag(), data].map((part) => (Buffer.isBuffer(part) ? part.toString("base64url") : part)).join(".");
    },

    decrypt(purpose, token) {
      const [version, iv, tag, data] = String(token).split(".");
      if (version !== FORMAT_VERSION) throw new Error("Formato de dato cifrado desconocido");
      const decipher = createDecipheriv(CIPHER, subkey(purpose), Buffer.from(iv, "base64url"));
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
    },
  };
}
