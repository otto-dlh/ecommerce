// Puertos de pedidos, direcciones y pagos.

/**
 * @typedef {object} OrderLine
 * @property {string} productId
 * @property {string} name
 * @property {number} unitPrice   centavos, tal como se cotizo
 * @property {number} qty
 * @property {number} lineTotal
 */

/**
 * @typedef {object} Order
 * @property {string} id
 * @property {string} userId
 * @property {OrderLine[]} items
 * @property {number} subtotal
 * @property {number} discount
 * @property {number} shipping
 * @property {number} total
 * @property {string|null} coupon
 * @property {{ name: string, line1: string, city: string, phone: string }} address
 * @property {string} status
 * @property {{ status: string, at: string, by: string }[]} history
 * @property {{ ref: string, last4: string, brand: string, eventId: string }|null} payment
 * @property {string} createdAt
 * @property {string|null} expiresAt
 */

/**
 * @typedef {object} OrderRepository
 * @property {(order: Order) => Promise<Order>} placeOrder
 *           atomico: verifica que cada producto siga activo y con el mismo precio, descuenta el stock
 *           (nunca bajo cero) y guarda el pedido. ConflictError si algo cambio o no hay existencias.
 * @property {(id: string) => Promise<Order|null>} findById
 * @property {(userId: string) => Promise<Order[]>} listByUser                   recientes primero
 * @property {(filter?: { status?: string }) => Promise<Order[]>} list          recientes primero
 * @property {(nowIso: string) => Promise<Order[]>} listOverdue                  pendientes con ventana de pago vencida
 * @property {(id: string, change: { from: string[], to: string, by: string, patch?: { payment?: object, expiresAt?: string }, releaseStock?: boolean }) => Promise<{ order: Order, from: string }>} updateStatus
 *           atomico: solo cambia si el estado actual esta en `from`; NotFoundError / ConflictError.
 *           `patch` solo admite los datos de pago y la expiracion.
 */

/**
 * @typedef {object} AddressRepository
 * @property {(userId: string) => Promise<object[]>} listByUser
 * @property {(userId: string, address: object) => Promise<object>} create
 * @property {(userId: string, id: string) => Promise<boolean>} delete    false si no existe o no es del usuario
 */

/**
 * @typedef {object} PaymentEventRepository
 * @property {(eventId: string, info: { type: string }) => Promise<boolean>} registerOnce   true solo la primera vez
 */

export const ORDER_PORTS = Object.freeze({
  orders: ["placeOrder", "findById", "listByUser", "list", "listOverdue", "updateStatus"],
  addresses: ["listByUser", "create", "delete"],
  paymentEvents: ["registerOnce"],
});
