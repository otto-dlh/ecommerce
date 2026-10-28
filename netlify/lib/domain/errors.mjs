// Errores del dominio: describen QUE fallo, no como se responde.
// La capa HTTP los traduce a codigos de estado (http/errorMapper.mjs); otras capas pueden ignorar HTTP.

export class DomainError extends Error {
  /**
   * @param {string} message Mensaje seguro para mostrar al usuario
   * @param {Record<string, unknown>} [details] Datos extra seguros (campo invalido, segundos de espera...)
   */
  constructor(message, details = {}) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}

/** Entrada invalida (formato, rango, campo obligatorio). */
export class ValidationError extends DomainError {}

/** Falta una sesion valida. */
export class UnauthenticatedError extends DomainError {}

/** Hay sesion, pero el rol o la politica no permiten la operacion. */
export class ForbiddenError extends DomainError {}

/** El recurso no existe o no pertenece a quien lo pide (respuesta uniforme anti-IDOR). */
export class NotFoundError extends DomainError {}

/** El estado actual impide la operacion (sin stock, transicion invalida, duplicado...). */
export class ConflictError extends DomainError {}

/** Se supero un limite de frecuencia; details.retryAfter indica los segundos de espera. */
export class TooManyRequestsError extends DomainError {}

/**
 * Errores de integridad que pueden detectar los adaptadores de datos.
 * Los mensajes viven aqui (y no en la base de datos) para que todos los proveedores respondan igual.
 */
export const integrityErrors = Object.freeze({
  orderNotFound: () => new NotFoundError("Pedido no encontrado"),
  orderExists: () => new ConflictError("El pedido ya existe"),
  transitionNotAllowed: (from, to) => new ConflictError(`Transición no permitida: ${from} → ${to}`),
  productUnavailable: (name) => new ConflictError(`Producto no disponible: ${name}`),
  priceChanged: () => new ConflictError("El precio de un producto cambió; revisa tu carrito"),
  outOfStock: (name) => new ConflictError(`Sin existencias suficientes de "${name}"`),
  negativeStock: () => new ConflictError("El inventario no puede quedar negativo"),
  auditAppendOnly: () => new ForbiddenError("La bitácora de auditoría es de solo inserción"),
});
