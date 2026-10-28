// Puertos del catalogo: categorias, productos, cupones y resenas.

/**
 * @typedef {object} Category
 * @property {string} id           slug
 * @property {string} name
 * @property {string} description
 * @property {boolean} active
 * @property {number} sortOrder
 */

/**
 * @typedef {object} Product
 * @property {string} id           slug
 * @property {string} name
 * @property {string} description
 * @property {number} price        centavos
 * @property {string} categoryId
 * @property {string} emoji
 * @property {string} color        #rrggbb
 * @property {string|null} image   ruta local o URL de almacenamiento
 * @property {string|null} imageKey clave en FileStorage (para reemplazar o borrar)
 * @property {number} stock
 * @property {boolean} active
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {object} CategoryRepository
 * @property {() => Promise<Category[]>} list                      ordenadas por sortOrder y nombre
 * @property {(id: string) => Promise<Category|null>} findById
 * @property {(category: Category) => Promise<Category>} create    ConflictError si el id existe
 * @property {(id: string, changes: Partial<Category>) => Promise<Category|null>} update
 */

/**
 * @typedef {object} ProductRepository
 * @property {() => Promise<Product[]>} list
 * @property {(id: string) => Promise<Product|null>} findById
 * @property {(ids: string[]) => Promise<Product[]>} findByIds
 * @property {(product: Product) => Promise<Product>} create      ConflictError si el id existe
 * @property {(id: string, changes: Partial<Product>) => Promise<Product|null>} update
 * @property {(id: string, delta: number) => Promise<{ before: number, after: number }|null>} adjustStock
 *           atomico; ConflictError si el stock quedaria negativo
 * @property {(categoryId: string) => Promise<number>} countByCategory
 */

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
 * @typedef {object} Review
 * @property {string} id
 * @property {string} productId
 * @property {string} userId
 * @property {string} userName
 * @property {number} rating
 * @property {string} text
 * @property {boolean} hidden
 * @property {string|null} moderatedBy
 * @property {string} createdAt
 */

/**
 * @typedef {object} ReviewRepository
 * @property {(productId: string, options?: { includeHidden?: boolean }) => Promise<Review[]>} listByProduct   recientes primero
 * @property {(filter?: { hidden?: boolean, limit?: number }) => Promise<Review[]>} list
 * @property {(id: string) => Promise<Review|null>} findById
 * @property {(review: Review) => Promise<Review>} create
 * @property {(id: string, change: { hidden: boolean, moderatedBy: string }) => Promise<Review|null>} setHidden
 */

export const CATALOG_PORTS = Object.freeze({
  categories: ["list", "findById", "create", "update"],
  products: ["list", "findById", "findByIds", "create", "update", "adjustStock", "countByCategory"],
  coupons: ["list", "findByCode", "create", "update", "hasRedeemed", "redeem"],
  reviews: ["listByProduct", "list", "findById", "create", "setHidden"],
});
