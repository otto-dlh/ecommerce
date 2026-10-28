// Validacion de entradas en la capa confiable (ASVS v5.0.0-2.2.1 / 2.2.2, T02).
// Cada caso de uso toma explicitamente solo los campos permitidos (evita asignacion masiva).
import { ValidationError } from "./errors.mjs";

const invalid = (field, message) => new ValidationError(message || `Campo inválido: ${field}`, { field });

// Caracteres de control (excepto salto de linea y tabulador)
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function str(value, field, { min = 1, max = 200, pattern, optional = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (optional) return "";
    throw invalid(field, `El campo ${field} es obligatorio`);
  }
  if (typeof value !== "string") throw invalid(field);
  const s = value.normalize("NFC").trim();
  if (CONTROL_CHARS.test(s)) throw invalid(field);
  if (s.length < min || s.length > max) throw invalid(field, `${field} debe tener entre ${min} y ${max} caracteres`);
  if (pattern && !pattern.test(s)) throw invalid(field);
  return s;
}

export function int(value, field, { min, max }) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw invalid(field, `${field} debe ser un entero entre ${min} y ${max}`);
  }
  return value;
}

export function bool(value, field) {
  if (typeof value !== "boolean") throw invalid(field);
  return value;
}

export function oneOf(value, field, allowed) {
  if (!allowed.includes(value)) throw invalid(field);
  return value;
}

// Solo ASCII imprimible: evita suplantacion con caracteres Unicode parecidos (p. ej. "а" cirilica por "a")
const EMAIL = /^[\x21-\x3F\x41-\x7E]+@[\x21-\x3F\x41-\x7E]+\.[A-Za-z]{2,}$/;

export function email(value) {
  return str(value, "email", { min: 5, max: 254, pattern: EMAIL }).toLowerCase();
}

/** Identificadores de URL y de negocio: letras, numeros, guion y guion bajo. */
export const id = (value, field = "id") => str(value, field, { max: 64, pattern: /^[a-zA-Z0-9_-]+$/ });

/** Identificador legible (slug) para productos y categorias. */
export const slug = (value, field = "id") => str(value, field, { min: 2, max: 40, pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ });

/** Fecha ISO 8601 opcional; devuelve null si viene vacia. */
export function isoDate(value, field) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw invalid(field, `${field} debe ser una fecha válida`);
  return new Date(value).toISOString();
}

const COMMON_PASSWORDS = new Set([
  "123456789012", "password1234", "contraseña123", "qwertyuiop12", "administrador", "tiendaenlinea",
]);

// Politica de contrasenas: minimo 12, maximo 128, sin reglas de composicion forzada
// y bloqueo de contrasenas comunes (ASVS cap. 6 / NIST SP 800-63B).
export function password(value, field = "password") {
  if (typeof value !== "string") throw invalid(field);
  if (value.length < 12 || value.length > 128) throw invalid(field, "La contraseña debe tener entre 12 y 128 caracteres");
  if (COMMON_PASSWORDS.has(value.toLowerCase())) throw invalid(field, "La contraseña es demasiado común");
  return value;
}
