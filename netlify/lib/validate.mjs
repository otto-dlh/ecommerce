// Validacion de entradas en la capa confiable del backend (ASVS v5.0.0-2.2.1 / 2.2.2, T02).
// Cada endpoint toma explicitamente solo los campos permitidos (evita asignacion masiva).
import { HttpError } from "./http.mjs";

const bad = (field, msg) => new HttpError(400, msg || `Campo inválido: ${field}`, { field });

export function str(v, field, { min = 1, max = 200, pattern, optional = false } = {}) {
  if (v === undefined || v === null || v === "") {
    if (optional) return "";
    throw bad(field, `El campo ${field} es obligatorio`);
  }
  if (typeof v !== "string") throw bad(field);
  const s = v.normalize("NFC").trim();
  // Se rechazan caracteres de control (excepto salto de linea y tab)
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(s)) throw bad(field);
  if (s.length < min || s.length > max) throw bad(field, `${field} debe tener entre ${min} y ${max} caracteres`);
  if (pattern && !pattern.test(s)) throw bad(field);
  return s;
}

export function int(v, field, { min, max }) {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) {
    throw bad(field, `${field} debe ser un entero entre ${min} y ${max}`);
  }
  return v;
}

export function bool(v, field) {
  if (typeof v !== "boolean") throw bad(field);
  return v;
}

export function oneOf(v, field, list) {
  if (!list.includes(v)) throw bad(field);
  return v;
}

export function email(v) {
  const s = str(v, "email", { min: 5, max: 254, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/ });
  return s.toLowerCase();
}

export const id = (v, field = "id") => str(v, field, { max: 64, pattern: /^[a-zA-Z0-9_-]+$/ });

const COMMON = new Set([
  "123456789012", "password1234", "contraseña123", "qwertyuiop12", "administrador", "tiendaenlinea",
]);

// Politica de contrasenas: longitud minima 12, maxima 128, sin reglas de composicion
// forzada y con bloqueo de contrasenas comunes (ASVS cap. 6 / NIST SP 800-63B).
export function password(v, field = "password") {
  if (typeof v !== "string") throw bad(field);
  if (v.length < 12 || v.length > 128) throw bad(field, "La contraseña debe tener entre 12 y 128 caracteres");
  if (COMMON.has(v.toLowerCase())) throw bad(field, "La contraseña es demasiado común");
  return v;
}
