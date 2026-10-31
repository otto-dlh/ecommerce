// Datos iniciales. Idempotente: solo crea lo que falta.
// Usa unicamente los puertos, asi que funciona igual con cualquier proveedor de datos.
// - Siempre: categorias, productos, cupones y la cuenta de administrador (contrasena de SEED_PASSWORD_ADMIN).
// - Solo con `demoAccounts` (proveedor en memoria: desarrollo y pruebas): una cuenta por rol con
//   contrasena conocida y el pedido ajeno para la prueba IDOR. En la base de datos real nunca se crean.
import { randomUUID } from "node:crypto";
import { hashPassword } from "../shared/security/crypto.mjs";
import * as v from "../shared/domain/validate.mjs";

export const DEMO_FOREIGN_ORDER_ID = "demo-pedido-cliente2";

const CATEGORIES = [
  ["cafe", "Café", "Café guatemalteco de altura", 1],
  ["hogar", "Hogar", "Artesanía y cocina", 2],
  ["electronica", "Electrónica", "Accesorios tecnológicos", 3],
  ["accesorios", "Accesorios", "Para el día a día", 4],
  ["ropa", "Ropa", "Prendas con identidad local", 5],
];

// Precios en centavos de quetzal (enteros: sin errores de redondeo en importes).
const PRODUCTS = [
  ["cafe-huehue", "Café de Huehuetenango 454 g", "Café de altura, tueste medio, notas a chocolate y frutos rojos.", 9500, "cafe", "☕", "#7c4a2d", 40],
  ["cafe-antigua", "Café Antigua Pastores 454 g", "Grano entero de volcán, tueste oscuro, cuerpo intenso.", 11000, "cafe", "🫘", "#5b3a29", 35],
  ["prensa-francesa", "Prensa francesa 1 L", "Vidrio borosilicato y filtro de acero inoxidable.", 27500, "hogar", "🫖", "#2f6f73", 18],
  ["taza-barro", "Taza de barro de Chinautla", "Hecha a mano por artesanas, 350 ml.", 6500, "hogar", "🏺", "#b5651d", 25],
  ["textil-tipico", "Camino de mesa tejido", "Textil de telar de cintura, 180 × 35 cm.", 18900, "hogar", "🧶", "#a8324a", 12],
  ["audifonos-bt", "Audífonos Bluetooth", "Cancelación de ruido activa, 30 h de batería.", 64900, "electronica", "🎧", "#334155", 15],
  ["cargador-usbc", "Cargador USB-C 65 W", "GaN, dos puertos, compatible con laptop.", 32900, "electronica", "🔌", "#1e3a8a", 30],
  ["teclado-mec", "Teclado mecánico compacto", "Switches táctiles, distribución en español.", 79900, "electronica", "⌨️", "#3f3f46", 8],
  ["mochila", "Mochila urbana 20 L", "Tela impermeable con compartimento para laptop.", 42500, "accesorios", "🎒", "#166534", 20],
  ["botella", "Botella térmica 750 ml", "Mantiene frío 24 h y caliente 12 h.", 15900, "accesorios", "🧴", "#0e7490", 50],
  ["playera", "Playera algodón orgánico", "Corte unisex, estampado de quetzal.", 12900, "ropa", "👕", "#4d7c0f", 45],
  ["gorra", "Gorra bordada", "Ajustable, bordado a mano.", 9900, "ropa", "🧢", "#9a3412", 30],
  ["edicion-limitada", "Jade tallado — edición limitada", "Pieza única. Úsala para la prueba de concurrencia (T14).", 150000, "accesorios", "💚", "#047857", 1],
];

const COUPONS = [
  { code: "BIENVENIDA10", label: "10 % de descuento en tu primera compra", type: "percent", value: 10, minSubtotal: 10000, oncePerUser: true },
  { code: "QUETZAL50", label: "Q50 de descuento en compras desde Q400", type: "fixed", value: 5000, minSubtotal: 40000, oncePerUser: false },
  { code: "ENVIOGRATIS", label: "Envío gratis", type: "shipping", value: 0, minSubtotal: 0, oncePerUser: false },
];

const ADMIN = { role: "admin", email: "admin@tienda.test", name: "Ana Administradora" };

/** Solo desarrollo y pruebas (proveedor en memoria): una cuenta por rol con contrasena conocida. */
export const DEMO_ACCOUNTS = Object.freeze([
  { ...ADMIN, password: "Admin#Demo2026!" },
  { role: "operador", email: "operador@tienda.test", name: "Óscar Operador", password: "Operador#Demo2026!" },
  { role: "auditor", email: "auditor@tienda.test", name: "Aurora Auditora", password: "Auditor#Demo2026!" },
  { role: "cliente", email: "cliente@tienda.test", name: "Carla Cliente", password: "Cliente#Demo2026!" },
  { role: "cliente", email: "cliente2@tienda.test", name: "Carlos Cliente", password: "Cliente2#Demo2026!" },
]);

async function seedCategories({ categories }) {
  for (const [id, name, description, sortOrder] of CATEGORIES) {
    if (!(await categories.findById(id))) await categories.create({ id, name, description, active: true, sortOrder });
  }
}

async function seedProducts({ products }, now) {
  for (const [id, name, description, price, categoryId, emoji, color, stock] of PRODUCTS) {
    if (await products.findById(id)) continue;
    await products.create({ id, name, description, price, categoryId, emoji, color, image: `/products/${id}.jpg`, imageKey: null, stock, active: true, createdAt: now, updatedAt: now });
  }
}

async function seedCoupons({ coupons }) {
  for (const coupon of COUPONS) {
    if (!(await coupons.findByCode(coupon.code))) await coupons.create({ ...coupon, active: true, maxUses: null, uses: 0, startsAt: null, endsAt: null });
  }
}

/** Crea la cuenta si no existe y devuelve su id. Sin contrasena no se crea nada (falla cerrado). */
async function ensureUser({ users }, { role, email, name }, password, now, hash) {
  const existing = await users.findByEmail(email);
  if (existing) return existing.id;
  if (!password) throw new Error(`Define SEED_PASSWORD_ADMIN (mínimo 12 caracteres) para crear la cuenta ${email}`);
  const user = await users.create({
    id: randomUUID(), email, name, role, active: true,
    passwordHash: await hash(v.password(password, "SEED_PASSWORD_ADMIN")),
    mfa: { enabled: false }, mustChangePassword: false, createdAt: now, lastLoginAt: null,
  });
  return user.id;
}

/** Pedido entregado de otro cliente con ID conocido para demostrar la proteccion IDOR (T04). */
async function seedForeignOrder({ orders }, ownerId, now) {
  if (await orders.findById(DEMO_FOREIGN_ORDER_ID)) return;
  await orders.placeOrder({
    id: DEMO_FOREIGN_ORDER_ID,
    userId: ownerId,
    items: [{ productId: "cafe-huehue", name: "Café de Huehuetenango 454 g", unitPrice: 9500, qty: 2, lineTotal: 19000 }],
    subtotal: 19000, discount: 0, shipping: 2500, total: 21500, coupon: null,
    address: { name: "Carlos Cliente", line1: "5a avenida 10-20, zona 1", city: "Guatemala", phone: "5555-0000" },
    status: "pendiente_pago",
    history: [{ status: "pendiente_pago", at: now, by: "seed" }],
    payment: null,
    createdAt: now,
    expiresAt: null,
  });
  const steps = [["pagado", { payment: { ref: "pay_demo", last4: "4242", brand: "visa", eventId: "evt_demo_seed" } }], ["preparando"], ["enviado"], ["entregado"]];
  let from = "pendiente_pago";
  for (const [to, patch] of steps) {
    await orders.updateStatus(DEMO_FOREIGN_ORDER_ID, { from: [from], to, by: "seed", patch });
    from = to;
  }
}

/**
 * @param {import("./ports.mjs").Adapters} repos
 * @param {{ adminPassword?: string|null, demoAccounts?: boolean, hash?: (password: string) => Promise<string> }} [options]
 *        `adminPassword` (SEED_PASSWORD_ADMIN) es obligatoria si falta el administrador; `demoAccounts` solo para el
 *        proveedor en memoria; `hash` inyectable para pruebas rapidas
 */
export async function seedInitialData(repos, { adminPassword = null, demoAccounts = false, hash = hashPassword } = {}) {
  const now = new Date().toISOString();
  await seedCategories(repos);
  await seedProducts(repos, now);
  await seedCoupons(repos);
  if (!demoAccounts) {
    await ensureUser(repos, ADMIN, adminPassword, now, hash);
    return;
  }
  const ids = {};
  for (const account of DEMO_ACCOUNTS) ids[account.email] = await ensureUser(repos, account, account.password, now, hash);
  await seedForeignOrder(repos, ids["cliente2@tienda.test"], now);
}
