// Acceso a InsForge: cliente administrativo, ejecucion de consultas y traduccion de errores.
// Es el UNICO modulo del proyecto que importa @insforge/sdk.
import { createAdminClient } from "@insforge/sdk";
import { ConflictError, ValidationError, integrityErrors } from "../../domain/errors.mjs";

/**
 * Codigos ASCII que lanzan las funciones del esquema (message) con el id afectado (details).
 * `ctx.nameOf(id)` permite mostrar el nombre del producto en vez de su id.
 */
const ERROR_BY_KEY = {
  order_not_found: () => integrityErrors.orderNotFound(),
  order_exists: () => integrityErrors.orderExists(),
  transition_not_allowed: (detail) => integrityErrors.transitionNotAllowed(...String(detail).split(">")),
  product_unavailable: (detail, ctx) => integrityErrors.productUnavailable(ctx.nameOf?.(detail) ?? detail),
  price_changed: () => integrityErrors.priceChanged(),
  out_of_stock: (detail, ctx) => integrityErrors.outOfStock(ctx.nameOf?.(detail) ?? detail),
  negative_stock: () => integrityErrors.negativeStock(),
  audit_append_only: () => integrityErrors.auditAppendOnly(),
};

/** Restricciones de integridad de PostgreSQL (SQLSTATE). */
const ERROR_BY_SQLSTATE = {
  23505: () => new ConflictError("El registro ya existe"),
  23503: () => new ValidationError("La referencia indicada no existe"),
  23514: () => new ValidationError("Un dato está fuera del rango permitido"),
};

export function toDomainError(error, ctx = {}) {
  const build = ERROR_BY_KEY[error?.message] ?? ERROR_BY_SQLSTATE[error?.code];
  if (build) return build(error.details, ctx);
  // Detalle solo para el log del servidor; el cliente recibe un error generico
  const detail = typeof error === "string" ? error : `${error?.code ?? ""} ${error?.message ?? "error desconocido"}`;
  return new Error(`InsForge: ${detail.trim()}`);
}

export function createInsforgeClient(env) {
  const baseUrl = env.INSFORGE_URL;
  const apiKey = env.INSFORGE_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("Faltan INSFORGE_URL o INSFORGE_API_KEY para el proveedor de datos insforge");
  return createAdminClient({ baseUrl, apiKey });
}

/** Envoltura minima: cada consulta devuelve datos o lanza un error del dominio. */
export function createDb(client) {
  async function run(query, ctx) {
    const { data, error } = await query;
    if (error) throw toDomainError(error, ctx);
    return data;
  }

  async function count(query) {
    const { count: total, error } = await query;
    if (error) throw toDomainError(error);
    return total ?? 0;
  }

  return {
    from: (table) => client.database.from(table),
    run,
    count,
    rpc: (fn, args, ctx) => run(client.database.rpc(fn, args), ctx),
    storage: client.storage,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Las columnas uuid rechazan otros formatos; para el dominio ese id simplemente no existe. */
export const isUuid = (value) => typeof value === "string" && UUID.test(value);

/** Fechas de PostgreSQL → ISO 8601 con milisegundos (el formato del dominio). */
export const toIso = (value) => (value === null || value === undefined ? null : new Date(value).toISOString());

/** Traduce solo las claves presentes de un objeto del dominio a columnas. */
export function pickColumns(changes, columnsByField) {
  const row = {};
  for (const [field, column] of Object.entries(columnsByField)) {
    if (changes[field] !== undefined) row[column] = changes[field];
  }
  return row;
}
