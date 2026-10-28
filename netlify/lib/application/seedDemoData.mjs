// Datos demo del prototipo. Idempotente: solo crea lo que falta.
// Usa unicamente los puertos, asi que funciona igual con cualquier proveedor de datos.
import { randomUUID } from "node:crypto";
import { hashPassword } from "../security/crypto.mjs";

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

// [rol, correo, nombre, variable de entorno con la contrasena, contrasena demo]
const USERS = [
  ["admin", "admin@tienda.test", "Ana Administradora", "SEED_PASSWORD_ADMIN", "Admin#Demo2026!"],
  ["operador", "operador@tienda.test", "Óscar Operador", "SEED_PASSWORD_OPERADOR", "Operador#Demo2026!"],
  ["auditor", "auditor@tienda.test", "Aurora Auditora", "SEED_PASSWORD_AUDITOR", "Auditor#Demo2026!"],
  ["cliente", "cliente@tienda.test", "Carla Cliente", "SEED_PASSWORD_CLIENTE", "Cliente#Demo2026!"],
  ["cliente", "cliente2@tienda.test", "Carlos Cliente", "SEED_PASSWORD_CLIENTE2", "Cliente2#Demo2026!"],
];

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

async function seedUsers({ users }, env, now, hash) {
  const ids = {};
  for (const [role, email, name, envVar, fallback] of USERS) {
    const existing = await users.findByEmail(email);
    if (existing) {
      ids[email] = existing.id;
      continue;
    }
    const user = await users.create({
      id: randomUUID(), email, name, role, active: true,
      // Las contrasenas demo se reemplazan con variables de entorno antes de sembrar en produccion
      passwordHash: await hash(env[envVar] || fallback),
      mfa: { enabled: false }, mustChangePassword: false, createdAt: now, lastLoginAt: null,
    });
    ids[email] = user.id;
  }
  return ids;
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
 * @param {import("../ports/index.mjs").Adapters} repos
 * @param {Record<string, string|undefined>} [env]   contrasenas SEED_PASSWORD_* opcionales
 * @param {{ hash?: (password: string) => Promise<string> }} [options]  inyectable para pruebas rapidas
 */
export async function seedDemoData(repos, env = {}, { hash = hashPassword } = {}) {
  const now = new Date().toISOString();
  await seedCategories(repos);
  await seedProducts(repos, now);
  await seedCoupons(repos);
  const ids = await seedUsers(repos, env, now, hash);
  await seedForeignOrder(repos, ids["cliente2@tienda.test"], now);
}
