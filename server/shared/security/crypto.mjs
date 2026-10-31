// Primitivas criptograficas puras con node:crypto (sin dependencias de terceros).
// No conocen secretos de la aplicacion: las claves llegan por parametro (ver keyring.mjs).
import { scrypt as scryptCb, randomBytes, timingSafeEqual, createHash, createHmac } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);

// Parametros recomendados por OWASP Password Storage Cheat Sheet: N=2^17, r=8, p=1
const SCRYPT = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize("NFKC"), salt, 64, SCRYPT);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), derived.toString("base64")].join("$");
}

export async function verifyPassword(password, stored) {
  const [alg, N, r, p, saltB64, hashB64] = String(stored).split("$");
  if (alg !== "scrypt") return false;
  const expected = Buffer.from(hashB64, "base64");
  const derived = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem,
  });
  return timingSafeEqual(derived, expected);
}

let dummyHash;
/** Verifica contra un hash ficticio cuando la cuenta no existe: el tiempo de respuesta no revela cuentas. */
export async function dummyVerify(password) {
  dummyHash ??= await hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(password, dummyHash);
  return false;
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256 = (s) => createHash("sha256").update(s).digest("hex");
export const hmacHex = (key, data) => createHmac("sha256", key).update(data).digest("hex");

/** Comparacion en tiempo constante, tambien para cadenas de distinto largo. */
export function safeEqual(a, b) {
  const ha = createHash("sha256").update(String(a)).digest();
  const hb = createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(ha, hb) && String(a).length === String(b).length;
}

// ---- TOTP RFC 6238 para MFA (ASVS v5.0.0-6.3.3, T01) ----
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf) {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  let bits = 0, value = 0;
  const out = [];
  for (const ch of str.replace(/=+$/, "").toUpperCase()) {
    const idx = B32.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const offset = h[h.length - 1] & 15;
  return ((h.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}

export const newTotpSecret = () => base32Encode(randomBytes(20));

/** Codigo TOTP actual (lo usan las pruebas automatizadas). */
export const totpNow = (secret, now = Date.now()) => hotp(secret, Math.floor(now / 1000 / 30));

/** Devuelve el contador TOTP que coincide (ventana +-1) o null. */
export function matchTotp(secret, code, now = Date.now()) {
  if (!/^\d{6}$/.test(String(code))) return null;
  const counter = Math.floor(now / 1000 / 30);
  for (const c of [counter - 1, counter, counter + 1]) {
    if (safeEqual(hotp(secret, c), code)) return c;
  }
  return null;
}
