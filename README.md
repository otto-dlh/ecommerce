# Tienda Segura — prototipo funcional

Prototipo de e-commerce del proyecto **Seguridad en Aplicaciones (UMG, 2026)**. Implementa los controles definidos en el Entregable 1 (STRIDE T01–T14, matriz ASVS 5.0.0) y está listo para desplegarse en **Netlify**.

- **Frontend:** React 19 + Vite (SPA)
- **API:** Netlify Functions (Node 22), equivalente serverless de la API Node/Express del documento
- **Persistencia:** Netlify Blobs privados (consistencia fuerte + escrituras condicionales por ETag)
- **Pagos:** pasarela *sandbox* simulada como función separada; la tienda nunca recibe el número de tarjeta ni el CVV

## Desplegar en Netlify

1. Sube esta carpeta a un repositorio Git (GitHub/GitLab) **privado**.
2. En Netlify: **Add new site → Import an existing project** y elige el repositorio. `netlify.toml` ya define el build (`pnpm run build`), la carpeta `dist`, las funciones y las cabeceras de seguridad.
3. En **Site configuration → Environment variables** define:

| Variable | Obligatoria | Uso |
|---|---|---|
| `APP_SECRET` | Sí (producción) | Secreto de ≥ 32 caracteres para firmar auditoría y webhooks. Genera uno con `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `REQUIRE_ADMIN_MFA` | Recomendada | `true` obliga a los administradores a tener MFA activo para usar el panel |
| `SEED_PASSWORD_ADMIN`, `SEED_PASSWORD_OPERADOR`, `SEED_PASSWORD_CLIENTE`, `SEED_PASSWORD_CLIENTE2` | Recomendada | Reemplazan las contraseñas demo **antes del primer arranque** |
| `ALLOWED_ORIGINS` | No | Orígenes extra permitidos (separados por coma) si usas un dominio adicional |

4. Despliega. En la primera petición se cargan los productos y las cuentas demo.
5. **Verificación obligatoria tras el despliegue:** abre `/seguridad`, inicia sesión como `cliente@tienda.test` y pulsa **Ejecutar todas**. Las 12 pruebas deben salir como "Bloqueado". La prueba **T14** (compras simultáneas de la última unidad) solo es confiable en el sitio desplegado (ver *Limitaciones*).

> Sin `APP_SECRET`, la app genera un secreto aleatorio y lo guarda en un store privado del sitio. Sirve para la demo, pero en producción hay que definirlo como variable de entorno.

## Desarrollo local

Requisitos: Node 22+ y pnpm 11 (`corepack enable`). El CLI de Netlify se descarga con `pnpm dlx`; no hace falta instalarlo.

```bash
pnpm install
pnpm dev      # Vite con recarga en caliente + funciones + Blobs emulados → http://localhost:8888
pnpm serve    # compila y sirve el build como en producción (con la CSP estricta) → http://localhost:8888
```

La **Content-Security-Policy** estricta se genera en `dist/_headers` solo al compilar (ver `vite.config.js`). En `pnpm dev` no se aplica porque Vite necesita un script en línea para la recarga en caliente; el script `dev` borra un `dist/_headers` que haya quedado de un build anterior. Para probar con la CSP, usa `pnpm serve`. Si compilas (`pnpm build`) con `pnpm dev` corriendo, borra `dist/_headers` o reinicia `pnpm dev`.

## Fotos de producto

Las fotos son de **Unsplash** bajo la [Unsplash License](https://unsplash.com/license): uso gratuito (comercial incluido), sin marca de agua y sin atribución obligatoria. Igual se muestra el crédito del fotógrafo en la página de cada producto. Se eligieron fotos de la licencia gratuita (no Unsplash+), sin personas ni marcas comerciales visibles.

- `scripts/photo-sources.json`: qué foto de Unsplash corresponde a cada producto.
- `node scripts/fetch-stock-photos.mjs [id ...]`: descarga las fotos con el enlace oficial (así la descarga le cuenta al fotógrafo), las recorta a 900×900, valida que sean JPEG y genera `public/products/credits.json`.
- Las fotos se sirven desde el propio sitio (`img-src 'self'`): el navegador no hace peticiones a terceros. Si un producto no tiene foto, se muestra su emoji sobre un degradado.

Para cambiar una foto: edita el id en `photo-sources.json` y ejecuta el script para ese producto.

## Cuentas demo

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | admin@tienda.test | `Admin#Demo2026!` |
| Operador | operador@tienda.test | `Operador#Demo2026!` |
| Cliente | cliente@tienda.test | `Cliente#Demo2026!` |
| Cliente 2 | cliente2@tienda.test | `Cliente2#Demo2026!` |

Tarjetas de prueba: `4242 4242 4242 4242` (aprobada) y `4000 0000 0000 0002` (rechazada). Cupones: `BIENVENIDA10`, `QUETZAL50`, `ENVIOGRATIS`.

## Funcionalidad

- Catálogo con búsqueda, categorías y orden; detalle de producto con reseñas.
- Carrito con importes **calculados por el servidor**; cupones validados en la API.
- Checkout con reserva de inventario por 15 minutos; pago en la pasarela sandbox; confirmación mediante webhook firmado.
- Cuenta de usuario: MFA TOTP, cambio de contraseña, cierre de todas las sesiones, direcciones guardadas.
- Panel de administración por rol: resumen y alertas de seguridad, catálogo, inventario (ajustes con motivo), pedidos (máquina de estados), usuarios/roles y bitácora de auditoría con verificación HMAC.
- Página `/seguridad`: matriz de controles y laboratorio que ejecuta los ataques del modelo STRIDE contra la API.

## Estructura

```
netlify/functions/api.mjs          Router + pipeline de seguridad (rate limit, sesión, CSRF, authN, authZ)
netlify/functions/sandbox-pay.mjs  Proveedor de pagos simulado (frontera F4)
netlify/lib/                       Sesiones, criptografía, validación, auditoría, stock y pedidos
netlify/lib/routes/                Endpoints: auth, tienda, administración, webhook de pagos
src/                               Frontend React
netlify.toml                       Build y cabeceras de seguridad (la CSP se genera desde vite.config.js)
scripts/fetch-stock-photos.mjs     Descarga de fotos de producto (Unsplash) y créditos
pnpm-workspace.yaml                Política de cadena de suministro de pnpm
```

## Verificación realizada

- `pnpm run build` sin errores.
- Prueba de punta a punta sobre `netlify serve` con 52 comprobaciones: catálogo, manipulación de precios, registro con asignación masiva, CSRF (token, Origin, Content-Type), compra, pago, webhook falso, IDOR, permisos de operador/cliente, máquina de estados, revocación de sesión, auditoría íntegra y fuerza bruta.
  - Los controles que deben responder 403/404 se verificaron con el código que devuelve la función según el log del servidor. El proxy local del CLI reintenta las respuestas 403/404 con variantes `.html`, y el cliente recibe la respuesta del último reintento. En Netlify las respuestas de las funciones llegan sin cambios.
- Revisión visual en escritorio y móvil.

## Limitaciones conocidas

- **Concurrencia (T14) en local:** el emulador local de Netlify Blobs no aplica `onlyIfMatch` de forma atómica: comprueba y escribe en pasos separados y calcula el ETag a partir del `mtime`. Con peticiones simultáneas puede haber sobreventa en local. El control depende de que Netlify Blobs en producción evalúe la condición en el servidor; **verifícalo con la prueba T14 del laboratorio tras desplegar**. Para producción real se recomienda PostgreSQL con transacciones y `SELECT … FOR UPDATE` (ver `CAMBIOS-DOCUMENTO.md`).
- La pasarela es una simulación: no consulta el estado al proveedor (T09 lo plantea como control adicional).
- Netlify no ofrece WAF configurable en todos los planes; el rate limiting es de aplicación.
