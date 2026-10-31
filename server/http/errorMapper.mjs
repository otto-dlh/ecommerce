// Traduce errores del dominio a respuestas HTTP. Es el unico lugar donde el dominio "se vuelve" HTTP.
import {
  ValidationError, UnauthenticatedError, ForbiddenError, NotFoundError, ConflictError, TooManyRequestsError,
} from "../shared/domain/errors.mjs";
import { HttpError } from "./http.mjs";

const STATUS_BY_TYPE = [
  [ValidationError, 400],
  [UnauthenticatedError, 401],
  [ForbiddenError, 403],
  [NotFoundError, 404],
  [ConflictError, 409],
  [TooManyRequestsError, 429],
];

/** HttpError equivalente, o null si el error no es esperado (sera un 500 generico). */
export function toHttpError(err) {
  if (err instanceof HttpError) return err;
  const match = STATUS_BY_TYPE.find(([Type]) => err instanceof Type);
  return match ? new HttpError(match[1], err.message, err.details) : null;
}

/** Cabeceras extra segun el error (p. ej. Retry-After en el 429). */
export const headersFor = (httpError) => (httpError.extra?.retryAfter ? { "retry-after": String(httpError.extra.retryAfter) } : {});
