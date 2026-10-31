import { INSFORGE, SKIPPED } from "./helpers.js";

// T12 · Leer la base de datos con la clave pública
export const readDatabaseWithAnonKey = {
  id: "T12", name: "Leer la base de datos con la clave pública",
  goal: "Usar la clave pública de InsForge (está en el JavaScript del sitio: es pública por diseño) para leer tablas directamente, saltándose la API.",
  steps: [
    ["atacante", "Copia la clave anónima que el sitio usa para el realtime; cualquiera puede verla en el código que descarga el navegador."],
    ["atacante", "Pide `GET /api/database/records/app_users` directo a InsForge con esa clave, buscando correos y hashes de contraseñas."],
    ["servidor", "InsForge ejecuta la consulta con el rol `anon` de PostgreSQL."],
    ["servidor", "Todas las tablas tienen RLS activado sin políticas y se les revocaron los permisos a `anon` y `authenticated`: PostgreSQL responde `permission denied` (42501)."],
    ["servidor", "Solo la API de la tienda, con la clave de administrador que vive en el servidor, puede leer y escribir datos."],
  ],
  expect: "Rechazo con `permission denied`: la clave pública no sirve para leer datos.",
  code: "migrations/*_tienda-schema.sql (sección 6) · server/infra/insforge/db.mjs",
  run: async () => {
    if (!INSFORGE.url) return SKIPPED;
    const r = await fetch(`${INSFORGE.url}/api/database/records/app_users?select=email,password_hash&limit=1`, { headers: { Authorization: `Bearer ${INSFORGE.anonKey}` } });
    const text = await r.text();
    const denied = !r.ok && /permission denied|42501/i.test(text);
    return { pass: denied, status: r.status, detail: denied ? "PostgreSQL negó la lectura al rol anónimo (42501)" : `Respuesta inesperada: ${text.slice(0, 80)}` };
  },
};
