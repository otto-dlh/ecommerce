// Reglas para imagenes subidas por el panel: tamano maximo y tipo REAL por firma de archivo
// (los primeros bytes), sin confiar en la extension ni en el Content-Type declarado.
import { ValidationError } from "../../../shared/domain/errors.mjs";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const SIGNATURES = [
  { mime: "image/jpeg", ext: "jpg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ext: "png", matches: (b) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, i) => b[i] === byte) },
  { mime: "image/webp", ext: "webp", matches: (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP" },
];

export const ACCEPTED_IMAGE_TYPES = Object.freeze(SIGNATURES.map((s) => s.mime));

const ascii = (bytes, start, end) => String.fromCharCode(...bytes.subarray(start, end));

/** Devuelve { mime, ext } del archivo o lanza ValidationError si no es una imagen permitida. */
export function assertValidImage(bytes) {
  if (!bytes?.length) throw new ValidationError("El archivo está vacío");
  if (bytes.length > MAX_IMAGE_BYTES) throw new ValidationError("La imagen supera el máximo de 2 MB");
  const type = SIGNATURES.find((s) => s.matches(bytes));
  if (!type) throw new ValidationError("Formato no permitido: usa JPEG, PNG o WebP");
  return { mime: type.mime, ext: type.ext };
}
