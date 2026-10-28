# Tienda Segura — prototipo funcional

Prototipo de e-commerce del proyecto **Seguridad en Aplicaciones (UMG, 2026)**. Implementa los controles definidos en el Entregable 1 (STRIDE T01–T14, matriz ASVS 5.0.0) y está listo para desplegarse en **Netlify**.

- **Frontend:** React 19 + Vite (SPA)
- **API:** Netlify Functions (Node 22), equivalente serverless de la API Node/Express del documento
- **Base de datos:** PostgreSQL en **InsForge** (proyecto «Tienda Segura»), con Storage para las fotos de producto y Realtime para los avisos en vivo
- **Pagos:** pasarela *sandbox* simulada como función separada; la tienda nunca recibe el número de tarjeta ni el CVV

## Arquitectura

```
Navegador ──HTTPS (cookie HttpOnly + CSRF)──▶ API Netlify (http → application → domain)
    ▲                                              │ puertos
    │                                              ▼
    │                                  infra/insforge (clave admin, solo servidor) ──▶ PostgreSQL · Storage · Realtime
    └──── WebSocket realtime (clave anónima, solo recibe avisos) ◀─────────────────────────────┘
```

- La **API de Netlify es la única puerta a los datos.** El navegador nunca consulta tablas: la clave anónima solo sirve para escuchar avisos en tiempo real, y la base de datos la rechaza para leer, escribir o ejecutar funciones (seguridad por filas activa, sin políticas y sin permisos para `anon`/`authenticated`).
- El **inicio de sesión es propio**: scrypt, sesión en cookie `__Host-` HttpOnly, CSRF, MFA TOTP y bloqueos. Se guarda en PostgreSQL; no se usa InsForge Auth (no ofrece MFA, revocación de sesiones ni bloqueo configurable).
- **Realtime:** cada aviso es solo una señal (ids y estado) y la página vuelve a pedir el detalle a la API, que es la que autoriza. Hay un canal público `catalog` (precio, stock, categorías, cupones, reseñas) y un canal privado por sesión con un id aleatorio de 128 bits (pedidos propios, panel según el rol, alertas y cierre de sesión forzado).

## Configuración

Las variables están documentadas en [`.env.example`](.env.example). Cópialo como `.env` (nunca se sube al repositorio) y complétalo. En Netlify se definen **las mismas** en *Site configuration → Environment variables*.

| Variable | Dónde | Uso |
|---|---|---|
| `DATA_PROVIDER` | Servidor | `insforge` (PostgreSQL real, por defecto) o `memory` (en memoria, se borra al reiniciar) |
| `INSFORGE_URL` | Servidor | URL del proyecto InsForge. Cambiar de endpoint = cambiar solo este valor |
| `INSFORGE_API_KEY` | Servidor | Clave de administrador del proyecto. **Nunca** con prefijo `VITE_` |
| `APP_SECRET` | Servidor | ≥ 32 caracteres. Firma la bitácora y los avisos de pago y cifra los secretos MFA. **Obligatoria:** sin ella la API no arranca. Local y Netlify comparten la base de datos, así que deben usar el **mismo valor** |
| `VITE_INSFORGE_URL` | Navegador | Misma URL que `INSFORGE_URL`; también se usa para la CSP (`connect-src` e `img-src`) |
| `VITE_INSFORGE_ANON_KEY` | Navegador | Clave anónima, pública por diseño: solo escucha avisos realtime |
| `ALLOWED_ORIGINS` | Servidor (opcional) | Orígenes extra permitidos (separados por coma) si usas un dominio adicional |
| `SEED_PASSWORD_ADMIN` | Solo `pnpm seed` | Contraseña inicial del administrador. Obligatoria si la base de datos todavía no tiene la cuenta `admin@tienda.test` |

Genera `APP_SECRET` con `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

### Preparar InsForge (solo la primera vez)

El proyecto ya está vinculado (`.insforge/project.json`, fuera del repositorio) y la base de datos ya tiene el esquema, el catálogo y la cuenta de administrador. Para montar uno nuevo:

```bash
npx -y @insforge/cli link                               # vincular el proyecto
npx -y @insforge/cli db migrations up --all             # esquema, RLS, funciones atómicas y canales realtime
npx -y @insforge/cli config apply --file insforge.toml  # registro de InsForge Auth desactivado
npx -y @insforge/cli storage create-bucket product-images
pnpm seed                                               # categorías, productos, cupones y administrador (idempotente; pide SEED_PASSWORD_ADMIN)
```

`disable_signup = true` es obligatorio: si alguien pudiera registrarse en InsForge Auth obtendría un token `authenticated`. El esquema le quita todos los permisos igualmente, pero así se cierra también esa puerta.

## Desplegar en Netlify

1. Sube esta carpeta a un repositorio Git (GitHub/GitLab) **privado**.
2. En Netlify: **Add new site → Import an existing project** y elige el repositorio. `netlify.toml` ya define el build (`pnpm run build`), la carpeta `dist`, las funciones y las cabeceras de seguridad.
3. Define las variables de la tabla anterior. Las `VITE_*` se leen **al compilar**: si las cambias, vuelve a desplegar.
4. Despliega. Los datos ya están en InsForge, así que el sitio arranca con el catálogo y la cuenta de administrador.
5. **Verificación obligatoria tras el despliegue:** abre `/seguridad`, inicia sesión con una cuenta de cliente (créala en «Crear cuenta») y pulsa **Ejecutar todas**. Todas las pruebas deben salir como «Bloqueado» u «Omitida». Para la prueba de solo lectura, el administrador puede asignar el rol Auditor a una cuenta desde «Usuarios».

## Desarrollo local

Requisitos: Node 22+ y pnpm 11 (`corepack enable`).

```bash
pnpm install
pnpm dev           # Vite con recarga en caliente + funciones de la API en el mismo proceso → http://localhost:8888
pnpm dev:netlify   # alternativa con `netlify dev` (ver nota)
pnpm serve         # compila y sirve el build como en producción (con la CSP estricta)
```

- `pnpm dev` ejecuta las funciones de `netlify/functions` dentro del servidor de Vite (`scripts/vite-local-functions.mjs`) y les pasa las variables del `.env`. Se prefiere a `netlify dev` porque su proxy reintenta toda respuesta 403/404 con variantes `.html` (imita al CDN), lo que cambia los códigos HTTP que devuelve la API y vuelve a ejecutar la solicitud. En Netlify las respuestas de las funciones llegan sin cambios.
- La **Content-Security-Policy** estricta se genera en `dist/_headers` solo al compilar (ver `vite.config.js`). En desarrollo no se aplica porque Vite necesita un script en línea para la recarga en caliente. Para probar con la CSP, usa `pnpm serve`.
- Para trabajar **sin InsForge**: `DATA_PROVIDER=memory pnpm dev` (en PowerShell: `$env:DATA_PROVIDER="memory"; pnpm dev`). La API arranca con el catálogo y una cuenta demo por rol en memoria (ver *Cuentas*); el realtime no emite avisos.

### Scripts de verificación

| Comando | Qué hace |
|---|---|
| `pnpm test` | Pruebas unitarias del dominio y los servicios, y suite de contrato contra el adaptador en memoria (`node --test`, sin dependencias) |
| `pnpm test:insforge` | La misma suite de contrato contra InsForge real. **Escribe datos de prueba** (los borra al terminar), pero los registros de auditoría que genera no se pueden borrar desde la API porque la bitácora es *append-only* |
| `pnpm check:permissions [url]` | Contra un servidor con `DATA_PROVIDER=memory`: inicia sesión con la cuenta demo de cada rol, llama a cada endpoint de administración y compara el código HTTP con la matriz de `domain/permissions.mjs` (por defecto contra `http://localhost:8888`) |
| `pnpm seed` | Siembra el catálogo, los cupones y el administrador en el proveedor configurado; solo crea lo que falta |

## Roles

La matriz vive en `netlify/lib/domain/permissions.mjs` y la aplica el pipeline HTTP en cada ruta; el frontend solo oculta botones.

| Permiso | Administrador | Operador | Auditor | Cliente |
|---|:-:|:-:|:-:|:-:|
| Comprar, sus pedidos, su cuenta | ✓ | ✓ | ✓ | ✓ |
| Resumen y alertas | ✓ | ✓ | ver | – |
| Productos, precios e imágenes | ✓ | – | – | – |
| Inventario | ✓ | ✓ | ver | – |
| Categorías y cupones | ✓ | – | ver | – |
| Pedidos | ✓ | ✓ (sin cancelar pagados) | ver | – |
| Moderar reseñas | ✓ | ✓ | – | – |
| Clientes (con consulta auditada) | ver | – | ver | – |
| Usuarios y roles | ✓ | – | ver | – |
| Accesos: sesiones, bloqueos, cuentas y política | ✓ | – | ver | – |
| Bitácora de auditoría | ✓ | – | ✓ | – |

Reglas adicionales: nadie cambia su propio rol ni su estado, siempre queda al menos un administrador activo, y cambiar el rol, desactivar una cuenta o restablecer la contraseña cierra todas las sesiones de esa persona al instante.

## Cuentas

- **Base de datos real (InsForge):** solo existe el administrador `admin@tienda.test`; su contraseña la define quien administra (`SEED_PASSWORD_ADMIN` en la primera siembra y luego «Mi cuenta → Cambiar contraseña»). Los clientes se registran en «Crear cuenta» y el administrador asigna los roles de personal en «Usuarios». Las cuentas demo que existían están desactivadas (se conserva su historial).
- **Desarrollo y pruebas (`DATA_PROVIDER=memory`):** se crea una cuenta demo por rol (administrador, operador, auditor y dos clientes) con contraseñas conocidas, definidas en `netlify/lib/application/seedData.mjs`. Nunca se crean en la base de datos real.
- **MFA:** en «Mi cuenta → Verificación en dos pasos» se escanea un código QR con la app autenticadora (o se ingresa la clave a mano).

Tarjetas de prueba: `4242 4242 4242 4242` (aprobada) y `4000 0000 0000 0002` (rechazada). Cupones: `BIENVENIDA10`, `QUETZAL50`, `ENVIOGRATIS` (se administran en el panel).

## Funcionalidad

- Catálogo con búsqueda, categorías y orden; detalle de producto con reseñas. Stock, precios y reseñas **en vivo**.
- Carrito con importes **calculados por el servidor**; cupones con vigencia, mínimo de compra, usos máximos y uno por cliente.
- Checkout con reserva de inventario por 15 minutos en una transacción atómica; pago en la pasarela sandbox; confirmación mediante webhook firmado, que la página de pago recibe en vivo.
- Cuenta de usuario: MFA TOTP, cambio de contraseña, cierre de todas las sesiones, direcciones guardadas.
- Panel de administración según el rol, con todas las secciones en vivo:
  - **Resumen** y alertas de seguridad de 24 h.
  - **Productos e inventario**: alta y edición, subida de fotos (JPEG, PNG o WebP de hasta 2 MB, con el tipo real verificado) y ajustes de stock con motivo.
  - **Categorías** y **Cupones**.
  - **Pedidos** con máquina de estados.
  - **Clientes** (solo lectura; abrir el detalle queda auditado).
  - **Reseñas**: ocultar y restaurar (no se borran).
  - **Usuarios** y roles.
  - **Accesos**: sesiones activas con cierre remoto, intentos fallidos y desbloqueo, cuentas (contraseña temporal de un solo uso y reinicio de MFA) y política de acceso editable dentro de rangos seguros.
  - **Auditoría** con verificación HMAC de cada registro.
- **Alertas en vivo por rol** (campana con contador, historial de la sesión y avisos emergentes; ver la tabla siguiente).
- Página `/seguridad`: matriz de controles, diagrama de fronteras de confianza y laboratorio que ejecuta los ataques del modelo STRIDE contra la API, incluidos los de la base de datos y el canal realtime.

### Alertas por rol

Qué es una alerta, su severidad y quién la recibe lo decide el dominio (`netlify/lib/domain/alerts.mjs`); el servidor la envía solo a los canales privados de las sesiones con el permiso correspondiente.

| Quién | Alertas |
|---|---|
| Cualquier cuenta | Nuevo inicio de sesión en tu cuenta (a tus otras sesiones) · tu cuenta se bloqueó por intentos fallidos · se desactivó tu verificación en dos pasos |
| Cliente | Pago confirmado · pedido en preparación, enviado o entregado · pedido cancelado o reserva vencida |
| Operador y administrador | Pedido pagado listo para preparar · anulación de un pedido ya pagado · stock bajo (≤ 3) o agotado · reseña nueva por moderar (las de 1–2 ★ destacadas) |
| Auditor y administrador | Cuenta bloqueada (crítica) · aviso de pago rechazado (crítica) · acceso denegado · CSRF · exceso de solicitudes · cambios administrativos (roles, contraseñas temporales, MFA, sesiones, desbloqueos, política) y consultas de datos de clientes |

Reglas: nunca se avisa a quien hizo la acción; las alertas llevan datos mínimos y enmascarados; las repeticiones del mismo hecho se agrupan durante 30 s en el servidor (un ataque no inunda al personal ni multiplica el costo) y durante 60 s en el navegador (contador «×N»). Las críticas quedan en pantalla hasta que alguien las cierra.

## Estructura

Arquitectura por capas con **puertos y adaptadores**: las dependencias apuntan hacia adentro y el dominio no conoce a InsForge.

```
netlify/functions/api.mjs          Punto de entrada de la API (compone pipeline + rutas)
netlify/functions/sandbox-pay.mjs  Proveedor de pagos simulado (frontera F4)
netlify/lib/domain/                Reglas puras, sin E/S: precios, cupones, estados del pedido, permisos, política de acceso, validación
netlify/lib/application/           Casos de uso (un servicio por responsabilidad), bus de eventos y notificador realtime
netlify/lib/ports/                 Contratos de cada repositorio (usuarios, sesiones, productos, pedidos, bitácora, archivos, realtime…)
netlify/lib/infra/insforge/        ÚNICO lugar que importa @insforge/sdk: repositorios, storage, realtime y traducción de errores
netlify/lib/infra/memory/          Adaptador en memoria (pruebas y desarrollo sin base de datos)
netlify/lib/infra/container.mjs    Raíz de composición: elige el adaptador según DATA_PROVIDER
netlify/lib/http/                  Pipeline (rate limit, sesión, CSRF, authN, authZ), errores → HTTP y rutas delgadas
netlify/lib/security/              scrypt, HMAC, TOTP, AES-GCM y claves derivadas por propósito
migrations/                        Esquema PostgreSQL del adaptador InsForge (tablas, RLS, RPC atómicas, canales)
src/realtime/                      Cliente realtime detrás de una interfaz + hooks useLiveRefresh / useRealtimeEvent
src/pages/admin/                   Un componente por sección del panel
tests/                             Dominio, servicios y suite de contrato de repositorios
scripts/                           seed, check-permissions, funciones en Vite y fotos de producto
netlify.toml                       Build y cabeceras de seguridad (la CSP se genera desde vite.config.js)
pnpm-workspace.yaml                Política de cadena de suministro de pnpm
```

## Cómo cambiar de base de datos

El cambio queda contenido en `netlify/lib/infra/`:

1. **Otro endpoint del mismo proveedor:** cambia `INSFORGE_URL`, `INSFORGE_API_KEY` y las `VITE_*`. No se toca código.
2. **Otra base de datos** (p. ej. Supabase, PostgreSQL propio, MongoDB):
   1. Crea `netlify/lib/infra/<proveedor>/index.mjs`, que devuelva los mismos repositorios que `infra/insforge/index.mjs`. Los contratos están en `netlify/lib/ports/` y `assertImplementsPorts` avisa al arrancar si falta alguno.
   2. Regístralo en `PROVIDERS` de `infra/container.mjs` (una línea) y define `DATA_PROVIDER=<proveedor>`.
   3. Ejecuta la suite de contrato contra él (copia `tests/contract/insforge.itest.mjs`): debe pasar las mismas pruebas que el adaptador en memoria y el de InsForge.
   4. Si es SQL, reutiliza `migrations/` como referencia. Lo que debe garantizar la base de datos es la **atomicidad** (crear el pedido descontando stock, cambiar el estado con comparación, contadores de rate limit) y que la bitácora sea *append-only*. Las reglas del negocio siguen en el dominio.
3. **Otro proveedor de realtime:** implementa el puerto `RealtimePublisher` en el servidor y la interfaz de `src/realtime/realtimeClient.js` en el navegador. Ninguna página usa el SDK directamente.

Dominio, servicios, rutas y frontend no cambian en ningún caso.

## Fotos de producto

Las fotos iniciales son de **Unsplash** bajo la [Unsplash License](https://unsplash.com/license): uso gratuito (comercial incluido), sin marca de agua y sin atribución obligatoria. Igual se muestra el crédito del fotógrafo en la página de cada producto. Se eligieron fotos de la licencia gratuita (no Unsplash+), sin personas ni marcas comerciales visibles.

- `scripts/photo-sources.json`: qué foto de Unsplash corresponde a cada producto.
- `node scripts/fetch-stock-photos.mjs [id ...]`: descarga las fotos con el enlace oficial (así la descarga le cuenta al fotógrafo), las recorta a 900×900, valida que sean JPEG y genera `public/products/credits.json`.
- Las fotos iniciales se sirven desde el propio sitio. Las que sube un administrador van al bucket público `product-images` de InsForge Storage, cuyo origen es el único externo permitido en `img-src`. Si un producto no tiene foto, se muestra su emoji sobre un degradado.

## Verificación realizada

- `pnpm run build` sin errores y `pnpm test` en verde (dominio, servicios y contrato en memoria). La suite de contrato también pasa contra InsForge real.
- Prueba de punta a punta sobre la API con InsForge: catálogo, manipulación de precios, registro con asignación masiva, CSRF (token, Origin, Content-Type), compra, pago, webhook falso, IDOR, permisos por rol, máquina de estados, revocación de sesión, auditoría íntegra y fuerza bruta.
- `pnpm check:permissions`: matriz de 4 roles × endpoints de administración sin diferencias.
- Realtime con navegadores reales: un visitante anónimo ve el cambio de stock y un cliente ve el cambio de estado de su pedido sin recargar (≈ 0,3 s); al cerrar una sesión desde «Accesos», la persona sale al instante.
- Alertas con operador, auditor y cliente conectados a la vez: cada rol recibe solo las suyas (pago, stock bajo, acceso denegado, nuevo inicio de sesión y bloqueo por fuerza bruta).
- Acceso directo con la clave anónima a tablas y RPC de PostgREST: rechazado.
- Subida real de imágenes a InsForge Storage.
- Revisión visual en escritorio y móvil.

## Limitaciones conocidas

- **Sin recuperación de contraseña por correo** ni verificación de correo: el envío propio requiere plan de pago de InsForge. La recuperación la hace un administrador desde Accesos → Cuentas con una contraseña temporal de un solo uso.
- **Revocación en realtime diferida:** un WebSocket ya suscrito no se expulsa por sí solo, pero recibe el aviso `session.revoked` (la página cierra la sesión) y la API rechaza la sesión de inmediato. Los avisos solo son señales, así que no exponen datos.
- Las migraciones SQL y la RLS de los canales son propias del adaptador InsForge/PostgreSQL. Otra base de datos necesita su propio esquema (ver *Cómo cambiar de base de datos*).
- La pasarela es una simulación: no consulta el estado al proveedor (T09 lo plantea como control adicional).
- Netlify no ofrece WAF configurable en todos los planes; el rate limiting es de aplicación.
