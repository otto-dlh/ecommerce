// Puertos del modulo de clientes: direcciones guardadas.

/**
 * @typedef {object} AddressRepository
 * @property {(userId: string) => Promise<object[]>} listByUser
 * @property {(userId: string, address: object) => Promise<object>} create
 * @property {(userId: string, id: string) => Promise<boolean>} delete    false si no existe o no es del usuario
 */

export const CUSTOMER_PORTS = Object.freeze({
  addresses: ["listByUser", "create", "delete"],
});
