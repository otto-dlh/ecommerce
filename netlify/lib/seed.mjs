// Datos iniciales del prototipo. Se ejecuta una sola vez por sitio (bloqueo con onlyIfNew).
import { randomUUID } from "node:crypto";
import { store, putJSON } from "./store.mjs";
import { hashPassword, sha256 } from "./crypto.mjs";

const SEED_VERSION = "seed-v1";

// Precios en centavos de quetzal (enteros: sin errores de redondeo en importes).
const PRODUCTS = [
  ["cafe-huehue", "Café de Huehuetenango 454 g", "Café de altura, tueste medio, notas a chocolate y frutos rojos.", 9500, "Café", "☕", "#7c4a2d", 40],
  ["cafe-antigua", "Café Antigua Pastores 454 g", "Grano entero de volcán, tueste oscuro, cuerpo intenso.", 11000, "Café", "🫘", "#5b3a29", 35],
  ["prensa-francesa", "Prensa francesa 1 L", "Vidrio borosilicato y filtro de acero inoxidable.", 27500, "Hogar", "🫖", "#2f6f73", 18],
  ["taza-barro", "Taza de barro de Chinautla", "Hecha a mano por artesanas, 350 ml.", 6500, "Hogar", "🏺", "#b5651d", 25],
  ["textil-tipico", "Camino de mesa tejido", "Textil de telar de cintura, 180 × 35 cm.", 18900, "Hogar", "🧶", "#a8324a", 12],
  ["audifonos-bt", "Audífonos Bluetooth", "Cancelación de ruido activa, 30 h de batería.", 64900, "Electrónica", "🎧", "#334155", 15],
  ["cargador-usbc", "Cargador USB-C 65 W", "GaN, dos puertos, compatible con laptop.", 32900, "Electrónica", "🔌", "#1e3a8a", 30],
  ["teclado-mec", "Teclado mecánico compacto", "Switches táctiles, distribución en español.", 79900, "Electrónica", "⌨️", "#3f3f46", 8],
  ["mochila", "Mochila urbana 20 L", "Tela impermeable con compartimento para laptop.", 42500, "Accesorios", "🎒", "#166534", 20],
  ["botella", "Botella térmica 750 ml", "Mantiene frío 24 h y caliente 12 h.", 15900, "Accesorios", "🧴", "#0e7490", 50],
  ["playera", "Playera algodón orgánico", "Corte unisex, estampado de quetzal.", 12900, "Ropa", "👕", "#4d7c0f", 45],
  ["gorra", "Gorra bordada", "Ajustable, bordado a mano.", 9900, "Ropa", "🧢", "#9a3412", 30],
  ["edicion-limitada", "Jade tallado — edición limitada", "Pieza única. Úsala para la prueba de concurrencia (T14).", 150000, "Accesorios", "💚", "#047857", 1],
];

const USERS = [
  ["admin", "admin@tienda.test", "Ana Administradora", "SEED_PASSWORD_ADMIN", "Admin#Demo2026!"],
  ["operador", "operador@tienda.test", "Óscar Operador", "SEED_PASSWORD_OPERADOR", "Operador#Demo2026!"],
  ["cliente", "cliente@tienda.test", "Carla Cliente", "SEED_PASSWORD_CLIENTE", "Cliente#Demo2026!"],
  ["cliente", "cliente2@tienda.test", "Carlos Cliente", "SEED_PASSWORD_CLIENTE2", "Cliente2#Demo2026!"],
];

export const DEMO_FOREIGN_ORDER_ID = "demo-pedido-cliente2";

let seeded;
export function ensureSeed() {
  seeded ??= runSeed().catch((err) => {
    seeded = undefined;
    throw err;
  });
  return seeded;
}

async function runSeed() {
  const meta = store("meta");
  if (await meta.get(SEED_VERSION)) return;
  const lock = await meta.set(`${SEED_VERSION}:lock`, String(Date.now()), { onlyIfNew: true });
  if (!lock.modified) return; // otra instancia esta sembrando

  const now = new Date().toISOString();
  for (const [id, name, description, price, category, emoji, color, stock] of PRODUCTS) {
    await putJSON("products", id, { id, name, description, price, category, emoji, color, image: `/products/${id}.jpg`, stock, active: true, createdAt: now, updatedAt: now });
  }

  const ids = {};
  for (const [role, email, name, envVar, fallback] of USERS) {
    const id = randomUUID();
    ids[email] = id;
    await putJSON("users", `u/${id}`, {
      id, email, name, role, active: true, createdAt: now,
      // Las contrasenas demo pueden reemplazarse con variables de entorno en Netlify
      passwordHash: await hashPassword(process.env[envVar] || fallback),
      mfa: { enabled: false },
      couponsUsed: [],
    });
    await putJSON("users", `email/${sha256(email)}`, { id });
  }

  // Pedido de otro cliente con ID conocido para demostrar la proteccion IDOR (T04)
  await putJSON("orders", DEMO_FOREIGN_ORDER_ID, {
    id: DEMO_FOREIGN_ORDER_ID,
    userId: ids["cliente2@tienda.test"],
    items: [{ productId: "cafe-huehue", name: "Café de Huehuetenango 454 g", unitPrice: 9500, qty: 2, lineTotal: 19000 }],
    subtotal: 19000, discount: 0, shipping: 2500, total: 21500, coupon: null,
    address: { name: "Carlos Cliente", line1: "5a avenida 10-20, zona 1", city: "Guatemala", phone: "5555-0000" },
    status: "entregado",
    history: [{ status: "entregado", at: now, by: "seed" }],
    payment: { ref: "pay_demo", last4: "4242", brand: "visa" },
    createdAt: now,
  });

  await meta.set(SEED_VERSION, now);
}
