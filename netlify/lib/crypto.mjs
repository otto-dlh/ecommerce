// Primitivas criptograficas usando solo node:crypto (sin dependencias de terceros).
import {
  scrypt as scryptCb,
  randomBytes,
  timingSafeEqual,
  createHash,
  createHmac,
} from "node:crypto";
import { promisify } from "node:util";
import { getStore } from "@netlify/blobs";

const scrypt = promisify(scryptCb);

// Parametros recomendados por OWASP Password Storage Cheat Sheet: N=2^17, r=8, p=1
const SCRYPT = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const dk = await scrypt(password.normalize("NFKC"), salt, 64, SCRYPT);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), dk.toString("base64")].join("$");
}

export async function verifyPassword(password, stored) {
  const [alg, N, r, p, saltB64, hashB64] = String(stored).split("$");
  if (alg !== "scrypt") return false;
  const expected = Buffer.from(hashB64, "base64");
  const dk = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT.maxmem,
  });
  return timingSafeEqual(dk, expected);
}

let dummyHash;
// Se verifica contra un hash ficticio cuando el usuario no existe para no revelar cuentas por tiempo de respuesta.
export async function dummyVerify(password) {
  dummyHash ??= await hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(password, dummyHash);
  return false;
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256 = (s) => createHash("sha256").update(s).digest("hex");
export const hmacHex = (key, data) => createHmac("sha256", key).update(data).digest("hex");

export function safeEqual(a, b) {
  const ha = createHash("sha256").update(String(a)).digest();
  const hb = createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(ha, hb) && String(a).length === String(b).length;
}

// ---- Secretos (ASVS v5.0.0-13.3.1): se leen de variables de entorno de Netlify. ----
// Si APP_SECRET no esta configurado, se genera uno aleatorio y se guarda en un store privado
// del sitio (nunca en el repositorio). En produccion debe definirse APP_SECRET.
let cachedSecret;
async function appSecret() {
  const env = process.env.APP_SECRET;
  if (env && env.length >= 32) return env;
  if (cachedSecret) return cachedSecret;
  const meta = getStore({ name: "meta", consistency: "strong" });
  let s = await meta.get("secret:app");
  if (!s) {
    await meta.set("secret:app", randomBytes(32).toString("base64url"), { onlyIfNew: true });
    s = await meta.get("secret:app");
  }
  cachedSecret = s;
  return s;
}

// Claves derivadas por proposito: una filtracion de uso no compromete las demas.
export async function subkey(purpose) {
  return createHmac("sha256", await appSecret()).update(`tienda-segura:${purpose}`).digest();
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
  const off = h[h.length - 1] & 15;
  const code = ((h.readUInt32BE(off) & 0x7fffffff) % 1_000_000).toString();
  return code.padStart(6, "0");
}

export const newTotpSecret = () => base32Encode(randomBytes(20));

/** Devuelve el contador TOTP que coincide (ventana +-1) o null. */
export function matchTotp(secret, code, now = Date.now()) {
  if (!/^\d{6}$/.test(String(code))) return null;
  const counter = Math.floor(now / 1000 / 30);
  for (const c of [counter - 1, counter, counter + 1]) {
    if (safeEqual(hotp(secret, c), code)) return c;
  }
  return null;
}
