# Arquitectura de Tienda Segura

Monolito modular con **puertos y adaptadores** (arquitectura hexagonal). Cada funcionalidad del negocio es un módulo con sus propias capas; las dependencias apuntan siempre hacia el dominio, y la infraestructura (InsForge, Netlify) queda en los bordes. El objetivo es que cambiar de base de datos, de endpoint o de hosting sea la mínima alteración posible, y que las fronteras de seguridad sean visibles en la estructura de carpetas.

```
Navegador ──HTTPS (cookie HttpOnly + CSRF)──▶ netlify/functions/api.mjs ──▶ server/http (pipeline de seguridad)
                                                                                 │
                                                                     server/modules/<módulo>/http
                                                                                 │
                                                       application (casos de uso) ──▶ domain (reglas puras)
                                                                                 │ puertos (ports.mjs)
                                                                                 ▼
                                                     server/infra/insforge  ó  server/infra/memory
                                                                                 │
                                                                 PostgreSQL · Storage · Realtime de InsForge
```

## Reglas de dependencia

Las hace cumplir `tests/architecture.test.mjs` en cada `pnpm test`: romper una regla rompe la prueba.

| Regla | Por qué |
|---|---|
| El `domain/` de un módulo solo importa su propio dominio o `server/shared/domain` | Las reglas del negocio no dependen de E/S, frameworks ni proveedores: se prueban en milisegundos y sobreviven a cualquier cambio de infraestructura |
| Entre módulos solo se importa el `index.mjs` del otro módulo | Cada módulo expone una API pública mínima; su interior puede cambiar sin romper a los demás |
| No hay ciclos entre módulos | Las dependencias forman un árbol: `identity ← catalog, sales, notifications`; `sales ← customers, reporting`; `catalog ← reporting` |
| `modules/` y `shared/` no importan `infra/`, `bootstrap/`, `http/` ni Netlify | La lógica no sabe qué base de datos ni qué hosting la ejecuta (inversión de dependencias) |
| `shared/` no importa ningún módulo | El núcleo compartido es genérico: errores, validación, criptografía, rate limit y eventos |
| Solo `server/infra/insforge/` usa `@insforge/sdk` y nadie en el navegador usa el cliente administrador | La clave de administrador queda confinada a un solo lugar del servidor |
| Solo `server/config.mjs` lee `process.env` | Una sola fuente de configuración, validada al arrancar |
| `src/` nunca importa `server/`, `netlify/`, `tooling/` ni módulos de Node | Ningún código del servidor (ni sus secretos) puede terminar en el JavaScript del navegador por accidente |
| `netlify/functions/` solo arranca el servidor (adaptadores de pocas líneas) | Cambiar de hosting = reescribir esos adaptadores, no la aplicación |
| En el navegador, las rutas de la API solo existen en `src/shared/api/endpoints.js` y solo `shared/api` usa el transporte HTTP | Cambiar un endpoint toca una línea; los parámetros se codifican en un solo lugar |
| `shared/` y `styles/` del frontend no importan features ni `app/`; las features se usan entre sí por su `index.js` | Las piezas genéricas siguen siéndolo y cada feature expone una API pública mínima |

## Módulos del servidor

| Módulo | Responsabilidad | Depende de |
|---|---|---|
| `identity` | Login propio (scrypt, sesiones con token hasheado, CSRF por sesión, MFA TOTP con anti-replay), usuarios y roles, matriz de permisos, política de acceso, administración de accesos | — |
| `catalog` | Productos, inventario, categorías, fotos (tipo real verificado), reseñas y su moderación | `identity` |
| `sales` | Precios y cupones, checkout atómico, pedidos (máquina de estados), webhook de pagos firmado, dirección de envío | `identity` |
| `customers` | Direcciones guardadas y consulta de clientes (cada detalle queda auditado) | `sales` |
| `audit` | Bitácora *append-only* con HMAC por registro y verificación de integridad | — |
| `reporting` | Resumen del panel: ventas, inventario y alertas de seguridad de 24 h | `sales`, `catalog` |
| `notifications` | Avisos realtime (señales sin datos) y alertas por rol | `identity` |

Dos mecanismos conectan los módulos sin acoplarlos:

- **La bitácora se inyecta**: todos los casos de uso reciben `audit` como dependencia; ninguno importa el módulo `audit`.
- **Bus de eventos (observador)**: los casos de uso anuncian hechos (`order.updated`, `stock.changed`, `audit.recorded`…) y `notifications` se suscribe. Un caso de uso no sabe que existe el realtime.

### Anatomía de un módulo

```
server/modules/<módulo>/
  domain/        Reglas puras: validación, cálculos, máquinas de estado, matrices. Sin E/S.
  application/   Casos de uso: create<Nombre>Service({ puertos, servicios }) → funciones. Reciben todo por parámetro.
  http/          Rutas: declaran método, ruta y opciones de seguridad (auth, perm, webhook, tipos de contenido).
                 routes.mjs registra todas las del módulo.
  ports.mjs      Contratos (JSDoc) y lista de métodos que cualquier adaptador debe implementar.
  index.mjs      API pública del módulo.
```

## Flujo de una petición

1. `netlify/functions/api.mjs` crea el manejador con `createApiHandler(getContainer, registerRoutes)`.
2. La primera petición de cada instancia arma el contenedor (`server/bootstrap/container.mjs`):
   1. `loadConfig()` valida las variables; si algo falla, el error nombra la variable sin mostrar su valor.
   2. Se cargan los adaptadores del proveedor elegido (`DATA_PROVIDER`) y `assertImplementsPorts` verifica que no falte ningún método.
   3. `createServices` compone los casos de uso y conecta los suscriptores del bus (notificador y alertas).
3. El pipeline (`server/http/pipeline.mjs`) aplica, en orden:
   1. Enrutamiento.
   2. Rate limit global.
   3. Política de acceso vigente.
   4. Sesión.
   5. CSRF y lectura del cuerpo con límite de tamaño (solo en métodos que modifican).
   6. Autorización (permiso de la ruta y MFA obligatoria para el personal).
4. La ruta del módulo llama al caso de uso, que trabaja contra los puertos y anuncia los hechos en el bus.
5. Los errores del dominio se traducen a HTTP (`errorMapper.mjs`). Un error inesperado responde 500 con un código `ref`, y el detalle queda solo en el log.

## Frontend

```
src/
  main.jsx       Entrada: estilos globales en orden de cascada + proveedores + App
  app/           App, tabla de rutas, RequireAuth, layout (Header, Footer, SessionNotice) y providers.jsx
                 (Router → sesión → realtime → alertas → carrito)
  shared/        api/ (cliente HTTP con CSRF y capa de acceso a la API), lib/ (format, permissions),
                 hooks/ (useApi), realtime/ (cliente + proveedor), ui/ (Brand, ProductImage, QrCode, Skeleton)
  styles/        tokens.css, base.css y components.css (globales)
  features/      auth · catalog · cart · checkout · orders · account · alerts · admin · security-lab
                 Cada feature tiene sus componentes, hooks, su CSS y un index.js público
```

- `shared/` y `styles/` son genéricos: no importan `features/` ni `app/`. Por eso `RealtimeProvider` recibe el canal privado por prop, y es `app/providers.jsx` quien lo conecta con la sesión.
- Una feature usa otra solo a través de su `index.js` (por ejemplo, `Totals` y `useQuote` salen de `cart` y `StatusBadge` de `orders`). Ninguna feature importa `app/`.
- **Acceso a la API centralizado** (`shared/api/`). Ningún componente escribe URLs, métodos HTTP ni llama a `fetch`; usa funciones de negocio como `ordersApi.cancel(id)` o `catalogApi.searchProducts(filtros)`. La capa tiene tres piezas:
  - `httpClient.js`: transporte (cookies, CSRF y errores).
  - `endpoints.js`: catálogo único de rutas. Los parámetros se codifican aquí, así que un id con `/` o `..` no puede alterar la ruta.
  - Un módulo por cada módulo del servidor (`identity`, `catalog`, `sales`, `customers`, `panel` y `paymentGateway`).

  Cambiar un endpoint toca una línea de `endpoints.js`. Dos pruebas lo hacen cumplir: la de arquitectura (no hay rutas fuera del catálogo y solo la capa usa el transporte) y `tests/contract/apiEndpoints.test.mjs` (cada endpoint del catálogo existe en el router del servidor con el mismo método). Los ataques del laboratorio son la excepción deliberada: mandan peticiones crudas y malformadas, pero toman la ruta del catálogo.
- **Cascada CSS:** cada módulo importa su hoja al final de sus imports, así la hoja de una dependencia siempre carga antes que la del módulo que la usa. Cada ajuste móvil vive junto a su regla base.
- **Laboratorio de seguridad:** `features/security-lab/attacks/` tiene un archivo por ataque, y `attacks/index.js` define el orden. `useAttackRunner` los ejecuta y `LabSteps` dibuja la línea de tiempo de cada uno.
- **Permisos en la interfaz:** solo ocultan opciones. La autorización real la decide siempre la API.

## Decisiones de diseño

1. **Login propio sobre InsForge, no InsForge Auth.** Se necesitaban MFA, revocación de sesiones, bloqueo configurable y desactivación de cuentas, que InsForge Auth no ofrece. Usuarios, sesiones y bloqueos se guardan en PostgreSQL.
2. **La API es la única puerta a los datos.** El navegador solo usa InsForge para escuchar avisos realtime con la clave anónima. Las tablas tienen RLS sin políticas y los permisos revocados a `anon` y `authenticated`.
3. **Realtime por señales.** Cada aviso lleva ids y estados; la página vuelve a pedir el detalle a la API, que es la que autoriza. Hay un canal privado por sesión con un id aleatorio de 128 bits.
4. **Configuración centralizada y validada al arrancar** (`server/config.mjs`). Un error de configuración se diagnostica desde el log de la función sin exponer secretos.
5. **La dirección de envío pertenece a ventas.** Así se evita el ciclo `sales ↔ customers`; `customers` reutiliza esa validación para las direcciones guardadas.
6. **Un solo paquete en vez de monorepo.** Netlify no necesita configuración extra y las fronteras las cuida `tests/architecture.test.mjs`.
7. **Pasarela simulada aislada** en `server/sandbox-gateway/`. Representa a un proveedor externo: no comparte lógica con la tienda, salvo la firma del webhook.

## Cómo extender

- **Una ruta nueva:**
  1. Agrégala en `http/` del módulo, con su opción `perm` o `auth`.
  2. Si el permiso es nuevo, agrégalo a la matriz de `identity/domain/permissions.mjs`.
  3. Verifica con `pnpm check:permissions` contra un servidor con `DATA_PROVIDER=memory`.
- **Un caso de uso nuevo:**
  1. Créalo en `application/` como fábrica que recibe sus dependencias.
  2. Expórtalo en el `index.mjs` del módulo.
  3. Compónlo en `server/bootstrap/services.mjs`.
- **Un módulo nuevo:**
  1. Crea la carpeta con `index.mjs`.
  2. Registra sus rutas en `server/bootstrap/routes.mjs` y sus puertos en `server/bootstrap/ports.mjs`.
  3. Implementa sus adaptadores en `server/infra/insforge/<módulo>.mjs` y `server/infra/memory/<módulo>.mjs`.
  4. Agrega su caso a la suite de contrato.
- **Otra base de datos u otro hosting:** ver «Cómo cambiar de base de datos» en el README.

## Seguridad que aporta la estructura

- **Frontera navegador ↔ servidor verificada:** ningún archivo de `src/` puede importar código del servidor.
- **La clave de administrador de InsForge vive en un único archivo** (`server/infra/insforge/db.mjs`) y llega desde una configuración validada.
- **Las reglas de seguridad de cada flujo están en un solo lugar del dominio:**
  - matriz de permisos;
  - política de acceso con rangos seguros;
  - máquina de estados del pedido;
  - validación de pagos;
  - reglas de alertas.
- **El pipeline HTTP aplica los controles transversales en un orden fijo** para todas las rutas: rate limit, sesión, CSRF, límites de cuerpo, autorización y MFA del personal.
- **Los adaptadores en memoria y de InsForge pasan la misma suite de contrato:** un proveedor nuevo no puede relajar una garantía (atomicidad, append-only, idempotencia) sin que lo detecte una prueba.
