// Piezas comunes de las pruebas del laboratorio.

/** Opciones de una peticion POST con cuerpo JSON (el cliente HTTP agrega el token CSRF). */
export const json = (body) => ({ method: "POST", body });

// Origen y clave publica de InsForge (las mismas que usa el realtime del sitio)
export const INSFORGE = { url: import.meta.env.VITE_INSFORGE_URL, anonKey: import.meta.env.VITE_INSFORGE_ANON_KEY };

/** Resultado de las pruebas que necesitan InsForge cuando el entorno no lo tiene configurado. */
export const SKIPPED = { skipped: true, status: "—", detail: "InsForge no está configurado en este entorno (VITE_INSFORGE_*)" };
