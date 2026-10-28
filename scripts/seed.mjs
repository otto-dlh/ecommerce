// Siembra los datos demo en el proveedor configurado (idempotente: solo crea lo que falta).
// Uso: pnpm seed   (lee .env; en produccion define antes las variables SEED_PASSWORD_*)
import { createContainer } from "../netlify/lib/infra/container.mjs";

const container = await createContainer(process.env, { seed: true });
const [categories, products, users] = await Promise.all([
  container.repos.categories.list(),
  container.repos.products.list(),
  container.repos.users.list(),
]);
console.log(`Proveedor: ${container.providerName}`);
console.log(`Categorías: ${categories.length} · Productos: ${products.length} · Usuarios: ${users.length}`);
for (const user of users) console.log(`  ${user.role.padEnd(8)} ${user.email}`);
