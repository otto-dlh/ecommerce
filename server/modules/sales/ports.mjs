// Puertos del modulo de ventas: cupones, pedidos y eventos de pago.

/**
 * @typedef {object} Coupon
 * @property {string} code
 * @property {string} label
 * @property {"percent"|"fixed"|"shipping"} type
 * @property {number} value
 * @property {number} minSubtotal
 * @property {boolean} oncePerUser
 * @property {boolean} active
 * @property {number|null} maxUses
 * @property {number} uses
 * @property {string|null} startsAt
 * @property {string|null} endsAt
 */

/**
 * @typedef {object} CouponRepository
 * @property {() => Promise<Coupon[]>} list
 * @property {(code: string) => Promise<Coupon|null>} findByCode
 * @property {(coupon: Coupon) => Promise<Coupon>} create          ConflictError si el codigo existe
 * @property {(code: string, changes: Partial<Coupon>) => Promise<Coupon|null>} update
 * @property {(userId: string, code: string) => Promise<boolean>} hasRedeemed
 * @property {(redemption: { code: string, userId: string, orderId: string }) => Promise<boolean>} redeem
 *           idempotente por pedido: true solo la primera vez para ese pedido (y entonces suma un uso)
 */

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
 * @typedef {object} PaymentEventRepository
 * @property {(eventId: string, info: { type: string }) => Promise<boolean>} registerOnce   true solo la primera vez
 */

export const SALES_PORTS = Object.freeze({
  coupons: ["list", "findByCode", "create", "update", "hasRedeemed", "redeem"],
  orders: ["placeOrder", "findById", "listByUser", "list", "listOverdue", "updateStatus"],
  paymentEvents: ["registerOnce"],
});
