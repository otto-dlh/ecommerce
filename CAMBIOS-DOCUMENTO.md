# Cambios a reflejar en el documento del proyecto

Decisiones del prototipo que difieren del Entregable 1 o lo concretan. Cada punto indica la sección o tabla del documento que conviene actualizar.

## A. Cambios por una opción más segura

| # | Documento dice / no define | Prototipo usa | Por qué es más seguro | Dónde actualizar |
|---|---|---|---|---|
| 1 | "Dependencia **npm** o imagen comprometida" (T06); gestor de paquetes no definido | **pnpm 11** con `minimumReleaseAge: 1440` (no instala versiones con menos de 24 h publicadas), `strictDepBuilds` (bloquea scripts `postinstall`), lockfile y `packageManager` fijado | Mitiga paquetes comprometidos recién publicados y la ejecución de código en la instalación; `node_modules` estricto evita dependencias fantasma. En la prueba eligió netlify-cli 27.12.0 en vez de la 27.12.1, publicada hacía menos de 24 h | Tabla 6 (T06), Tabla 12 (T06), Tabla 11 capa 2 y 3, sección SCA |
| 2 | Contraseñas: algoritmo no definido | **scrypt** N=2¹⁷, r=8, p=1, sal de 16 bytes (parámetros de OWASP Password Storage), solo con `node:crypto` | Resistente a GPU/ASIC; sin dependencias de terceros | Tabla 2 (agregar requisito de almacenamiento de contraseñas, ASVS cap. 11), T01 |
| 3 | Política de contraseñas no definida | Mínimo 12 y máximo 128 caracteres, sin reglas de composición forzada, bloqueo de contraseñas comunes (NIST SP 800-63B) | Mejor entropía real y menos contraseñas predecibles | Tabla 2, T01 |
| 4 | Sesiones: "cookies seguras" | Token aleatorio de 256 bits **guardado solo como SHA-256**; cookie `__Host-` + `HttpOnly` + `Secure` + `SameSite=Strict`; inactividad 30 min, máximo 8 h; rotación en login; revocación de todas las sesiones al cambiar contraseña o rol | Una fuga del almacén de sesiones no permite secuestrarlas; el prefijo `__Host-` impide inyectar la cookie desde subdominios | v5.0.0-3.3.4, 7.1.1 (valores concretos), 7.2.4, 7.4.1 |
| 5 | CSRF: "antifalsificación, validación de Origin/SameSite" | **Tres capas:** validación de `Origin`/`Sec-Fetch-Site`, `Content-Type: application/json` obligatorio y token sincronizado `X-CSRF-Token` ligado a la sesión | Defensa en profundidad: si falla una capa, las otras siguen bloqueando | T13, v5.0.0-3.5.1, Tabla 12 |
| 6 | Fuerza bruta: "rate limit" | Límite por IP (30/15 min), **intentos fallidos** por IP+cuenta (5/15 min) y por cuenta desde cualquier IP (20/15 min); los logins correctos no consumen cupo; verificación con hash ficticio para no revelar si la cuenta existe | Frena el credential stuffing distribuido sin bloquear a usuarios legítimos ni permitir enumerar cuentas | T01, v5.0.0-6.3.1 |
| 7 | MFA administrativa | **TOTP (RFC 6238) con anti-replay** (un código no se puede reutilizar); variable `REQUIRE_ADMIN_MFA=true` para hacerlo obligatorio | Evita que un código capturado se reutilice dentro de su ventana | T01, v5.0.0-6.3.3 |
| 8 | "Auditoría inalterable" | Bitácora *append-only* con **HMAC-SHA256 por registro** (clave derivada) y verificación de integridad en el panel; correos e IP enmascarados | Cualquier alteración de un registro se detecta; los logs no exponen datos personales | T03, v5.0.0-16.3.1, 16.3.2, 16.4.2 |
| 9 | Webhook: "firma, consulta del estado e idempotencia" | Firma **HMAC-SHA256 sobre `timestamp.cuerpo`**, ventana de 5 min contra replay, idempotencia por id de evento y **validación del monto y estado** del pedido | Un webhook capturado no se puede reenviar ni alterar el monto | T09 |
| 10 | Secretos en un gestor | Variables de entorno de Netlify + **claves derivadas por propósito** (auditoría ≠ webhooks) | Comprometer el uso de una clave no compromete los demás | T10, v5.0.0-13.3.1 |
| 11 | Hardening del frontend no detallado | **CSP sin `'unsafe-inline'`**, HSTS con `preload`, `X-Frame-Options: DENY`, `Permissions-Policy`, COOP/CORP; **tipografías autoalojadas** (sin CDNs externos); **sin source maps** en producción | Elimina dependencias de terceros en el navegador y reduce la superficie para XSS y clickjacking | Tabla 11 capa 5, sección Hardening del frontend |
| 11b | Recursos de terceros no definidos | Fotos de producto **autoalojadas** (Unsplash License) y rutas de imagen restringidas a `/products/*.jpg` en la API de administración | El navegador del cliente no contacta CDNs de terceros (sin rastreo ni dependencia externa) y un administrador no puede insertar URLs externas | Tabla 11 capa 5, A11 |
| 12 | Importes no especificados | Montos en **centavos enteros**, recalculados siempre en el servidor; el carrito del navegador solo guarda `productId` y cantidad | Sin errores de redondeo; el cliente no puede influir en el precio | T02, v5.0.0-2.2.1 |
| 13 | IDOR: "autorización por recurso" | Además, **404 uniforme** exista o no el recurso, e intento registrado como `authz.denied` | No revela la existencia de pedidos ajenos | T04, v5.0.0-8.2.2, 16.3.2 |
| 14 | Stock: "transacciones y bloqueo" | **Reserva por 15 min** con expiración automática y compensación si falla un producto del carrito | El inventario no queda bloqueado por pedidos abandonados | T14, v5.0.0-2.3.3 |

## B. Cambios de arquitectura (equivalencias, no necesariamente más seguros)

| Documento | Prototipo en Netlify | Nota para el documento |
|---|---|---|
| API Node.js/Express en Docker | Netlify Functions (Node 22, serverless) | Las secciones "Hardening de contenedores" y "Kubernetes" no aplican al prototipo; el aislamiento lo da el proveedor (responsabilidad compartida). Actualizar A09 y la Figura 3 |
| PostgreSQL en red privada | Netlify Blobs privados con escrituras condicionales (ETag) | Sin URL pública y sin SQL, así que T08 no tiene superficie SQL. **Pendiente para producción:** PostgreSQL con transacciones y `SELECT … FOR UPDATE` para T14, porque la atomicidad de Blobs no se pudo verificar en local. Actualizar A08, Tabla 3 y Figura 1 |
| CDN/WAF/proxy | CDN de Netlify + TLS gestionado + cabeceras + rate limit en la aplicación | El WAF administrado depende del plan de Netlify. Actualizar A10 y la sección WAF |
| CI/CD propio | Netlify Build desde rama protegida con lockfile | Actualizar A13 y T11 |
| Logs/SIEM | Logs JSON de funciones (enviables por Log Drains) + bitácora con HMAC | Actualizar las secciones SIEM y Alertas; el panel ya muestra alertas de 24 h |

## C. Detalles menores detectados en el documento

- Figura 2: la etiqueta del flujo hacia la pasarela dice "**SoRespuesta** y notificaciones (HTTPS)S"; debería ser "Respuesta y notificaciones (HTTPS)".
- Notas de las tablas 2, 4, 9 y 10: "Elaboracion Propia" sin tilde (las demás tablas dicen "Elaboración propia").
