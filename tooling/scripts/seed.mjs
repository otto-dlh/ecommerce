// Siembra los datos iniciales en el proveedor configurado (idempotente: solo crea lo que falta).
// Uso: pnpm seed   (lee .env). En la base de datos real crea solo el catalogo y el administrador:
// SEED_PASSWORD_ADMIN es obligatoria si el administrador todavia no existe.
import { createContainer } from "../../server/bootstrap/container.mjs";

const container = await createContainer(process.env, { seed: true });
const [categories, products, users] = await Promise.all([
  container.repos.categories.list(),
  container.repos.products.list(),
  container.repos.users.list(),
]);
console.log(`Proveedor: ${container.providerName}`);
console.log(`Categorías: ${categories.length} · Productos: ${products.length} · Usuarios: ${users.length}`);
for (const user of users) console.log(`  ${user.role.padEnd(8)} ${user.email}`);
