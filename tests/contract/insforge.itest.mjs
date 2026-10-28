// Suite de contrato contra el InsForge real (prueba de integracion, no corre con `pnpm test`).
// Uso: pnpm test:insforge   (lee .env)
// Escribe datos de prueba identificables (ct-*, @contrato.test) y los borra al terminar.
// Excepcion: la bitacora es de solo insercion; deja registros con action "contrato.prueba".
// Correla en una rama de InsForge o antes de cargar datos reales.
import { describeRepositoryContract } from "./repositoryContract.mjs";
import { createInsforgeAdapters } from "../../netlify/lib/infra/insforge/index.mjs";
import { createDb, createInsforgeClient } from "../../netlify/lib/infra/insforge/db.mjs";

async function purgeContractData() {
  const db = createDb(createInsforgeClient(process.env));
  const users = await db.run(db.from("app_users").select("id").like("email", "%@contrato.test"));
  const userIds = users.map((u) => u.id);
  // Orden de borrado segun las llaves foraneas (lo demas cae en cascada)
  if (userIds.length) await db.run(db.from("orders").delete().in("user_id", userIds));
  await db.run(db.from("products").delete().like("id", "ct-%"));
  await db.run(db.from("coupons").delete().like("code", "CT-%"));
  await db.run(db.from("categories").delete().like("id", "ct-%"));
  if (userIds.length) await db.run(db.from("app_users").delete().in("id", userIds));
  await db.run(db.from("rate_limits").delete().like("bucket", "contrato%"));
  await db.run(db.from("payment_events").delete().like("event_id", "evt_ct_%"));
}

if (process.env.DATA_PROVIDER !== "insforge" || !process.env.INSFORGE_URL) {
  throw new Error("Configura DATA_PROVIDER=insforge e INSFORGE_URL/INSFORGE_API_KEY (pnpm test:insforge usa .env)");
}

describeRepositoryContract("insforge", async () => createInsforgeAdapters(process.env), { cleanup: purgeContractData });
