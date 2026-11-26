// Catalogo de las pruebas del laboratorio de seguridad, del lado del servidor.
// Es la lista blanca de lo que el navegador puede reportar a la bitacora: el cliente solo envia
// una clave de esta tabla, y el nombre y la amenaza se toman de aqui (nunca del cuerpo de la peticion),
// para que una prueba reportada no pueda escribir texto arbitrario en la auditoria.
// Los nombres se muestran tal cual en el panel, por eso van redactados y con tildes.
//
// `superficie` dice quien puede dejar constancia del intento:
//   api       la prueba golpea nuestra API, asi que ademas del reporte hay registro propio del control
//   externo   el ataque va directo a InsForge (RLS / realtime): nuestra API no lo ve
//   navegador la comprobacion ocurre dentro del navegador y no genera ninguna peticion a la API
//
// Las claves deben coincidir con el campo `key` de src/features/security-lab/attacks/*.js
// (tests/modules/lab/labAudit.test.mjs lo verifica en cada `pnpm test`).

export const LAB_TESTS = Object.freeze({
  "precio-manipulado": { threat: "T02", name: "Enviar precio manipulado en la cotización", surface: "api" },
  "cantidad-negativa": { threat: "T02", name: "Cantidad negativa", surface: "api" },
  "pedido-ajeno": { threat: "T04", name: "Leer el pedido de otro cliente (IDOR)", surface: "api" },
  "listar-usuarios": { threat: "T04", name: "Escalar privilegios: listar usuarios como cliente", surface: "api" },
  "webhook-falsificado": { threat: "T09", name: "Webhook de pago falsificado", surface: "api" },
  "sin-token-csrf": { threat: "T13", name: "Petición de cambio sin token CSRF", surface: "api" },
  "cookie-httponly": { threat: "T13", name: "Cookie de sesión inaccesible desde JavaScript", surface: "navegador" },
  "inyeccion-busqueda": { threat: "T08", name: "Búsqueda con carga de inyección", surface: "api" },
  "xss-renderizado": { threat: "T07", name: "Carga XSS renderizada", surface: "navegador" },
  "fuerza-bruta": { threat: "T01", name: "Fuerza bruta: 6 intentos contra una cuenta", surface: "api" },
  "ultima-unidad": { threat: "T14", name: "Dos compras simultáneas de la última unidad", surface: "api" },
  "lectura-clave-publica": { threat: "T12", name: "Leer la base de datos con la clave pública", surface: "externo" },
  "funcion-base-datos": { threat: "T12", name: "Llamar una función interna de la base de datos", surface: "externo" },
  "canal-privado": { threat: "T04", name: "Escuchar el canal privado de otra sesión", surface: "externo" },
  "evento-falso": { threat: "T09", name: "Publicar un aviso falso en vivo", surface: "externo" },
  "escritura-sin-permiso": { threat: "T04", name: "Escribir sin permiso (auditor ajusta inventario)", surface: "api" },
  "cabeceras-seguridad": { threat: "Hardening", name: "Cabeceras de seguridad HTTP", surface: "navegador" },
});

/** Accion con la que el laboratorio queda en la bitacora (separada de los controles reales). */
export const LAB_ACTION = "lab.attack";

/** Resultados que el laboratorio puede reportar, y como se traducen al resultado de la bitacora. */
export const LAB_RESULTS = Object.freeze({
  bloqueado: "ok", //      la tienda detuvo el ataque: es el resultado esperado
  no_bloqueado: "failure", // el ataque NO fue detenido (o la prueba fallo): incidente que hay que mirar
  omitida: "ok", //        la prueba no se ejecuto en este entorno (sin sesion, sin InsForge, en desarrollo)
});

/** Codigo HTTP o marca de estado que muestra el laboratorio, saneado para la bitacora. */
export function cleanStatus(raw) {
  if (raw === undefined || raw === null) return null;
  const text = String(raw).replace(/[^\w\s/·—-]/gu, "").trim().slice(0, 40);
  return text || null;
}
