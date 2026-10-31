import { ENDPOINTS, request } from "../../../shared/api/index.js";
import { json } from "./helpers.js";

// T01 · Fuerza bruta: 6 intentos contra una cuenta
export const bruteForce = {
  id: "T01", name: "Fuerza bruta: 6 intentos contra una cuenta",
  goal: "Adivinar la contraseña de una cuenta probando muchas combinaciones (fuerza bruta).",
  steps: [
    ["lab", "Genera un correo de víctima al azar (`victima-xxxxxx@tienda.test`) para no bloquear ninguna cuenta real."],
    ["atacante", "Intentos 1 a 5: envía `POST /api/auth/login` con una contraseña incorrecta distinta cada vez."],
    ["servidor", "En cada intento revisa primero los contadores de la política de acceso (por defecto, en 15 minutos: 5 fallos por IP y cuenta, 20 por cuenta desde cualquier IP y 30 intentos por IP): todavía hay cupo."],
    ["servidor", "Verifica la contraseña con scrypt y falla (si el correo no existe, calcula igual un scrypt ficticio para tardar lo mismo). Suma el fallo a los contadores."],
    ["bitacora", "Registra «Inicio de sesión fallido» con el correo enmascarado."],
    ["servidor", "Responde `401` «Correo o contraseña incorrectos», sin revelar si el correo está registrado."],
    ["atacante", "Intento 6: la misma petición con otra contraseña."],
    ["servidor", "El contador ya llegó a 5 fallos: rechaza la petición antes de mirar la contraseña."],
    ["bitacora", "Registra «Bloqueo por exceso de solicitudes»."],
    ["servidor", "Responde `429` con la cabecera `Retry-After`: la cuenta queda pausada para esa IP (15 minutos por defecto) y aparece en Administración → Accesos, donde un administrador puede desbloquearla. Los inicios correctos nunca consumen el cupo."],
  ],
  expect: "`401 401 401 401 401 429`: el sexto intento ya ni siquiera se evalúa.",
  evidence: "Administración → Auditoría: «Inicio de sesión fallido» y «Bloqueo por exceso de solicitudes»",
  code: "server/modules/identity/application/authService.mjs · server/shared/security/rateLimiter.mjs",
  run: async () => {
    const email = `victima-${Math.random().toString(36).slice(2, 8)}@tienda.test`;
    const codes = [];
    for (let i = 0; i < 6; i++) {
      const r = await request(ENDPOINTS.identity.login.url(), { ...json({ email, password: `incorrecta-${i}` }), csrf: true });
      codes.push(r.status);
    }
    return { pass: codes[5] === 429, status: codes.join(" "), detail: "Los primeros 5 → 401, el sexto → 429 (bloqueado 15 min)" };
  },
};
