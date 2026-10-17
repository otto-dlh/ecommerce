import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { request } from "../api.js";
import { useAuth } from "../state.jsx";
import ControlsMatrix from "./security/ControlsMatrix.jsx";
import TrustDiagram from "./security/TrustDiagram.jsx";

const json = (body) => ({ method: "POST", body });

// Los fragmentos entre `comillas invertidas` se muestran como <code>; todo lo demas es texto plano.
const rich = (s) => s.split("`").map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));

// Cada prueba documenta su objetivo, los pasos del ataque que ejecuta el laboratorio
// y los pasos que sigue la tienda para bloquearlo (con el archivo donde vive el control).
function useTests(user) {
  return [
    {
      id: "T02", name: "Enviar precio manipulado en la cotización",
      goal: "Pagar menos cambiando el precio que el navegador envía al servidor.",
      attack: [
        "Arma a mano una petición `POST /api/cart/quote`, como haría alguien con las herramientas de desarrollador o con un proxy como Burp Suite.",
        "Pide 1 «Café de Huehuetenango» (precio real Q95.00) y agrega campos falsos: `price: 1`, `unitPrice: 1` y `total: 1`, es decir, Q0.01.",
        "Lee el subtotal que devuelve el servidor.",
      ],
      defense: [
        "`parseItems` toma de cada línea solo `productId` y `qty`; cualquier precio o total enviado se descarta sin leerlo.",
        "`quote` busca el producto en el almacén del servidor y usa el precio guardado ahí (9500 centavos).",
        "Subtotal, descuento, envío y total se recalculan en centavos enteros. El carrito y el checkout solo muestran lo que calcula el servidor.",
      ],
      expect: "`200` con subtotal Q95.00: el precio manipulado no tuvo ningún efecto.",
      code: "netlify/lib/orders.mjs",
      run: async () => {
        const r = await request("/api/cart/quote", json({ items: [{ productId: "cafe-huehue", qty: 1, price: 1, unitPrice: 1 }], total: 1 }));
        return { pass: r.ok && r.data.subtotal === 9500, status: r.status, detail: `El servidor ignoró price=1 y calculó subtotal Q${(r.data.subtotal / 100).toFixed(2)}` };
      },
    },
    {
      id: "T02", name: "Cantidad negativa",
      goal: "Que una cantidad negativa reste dinero del total o devuelva unidades al inventario.",
      attack: [
        "Envía `POST /api/cart/quote` con `qty: -5` de café.",
        "Si el servidor multiplicara sin validar, esa línea valdría −Q475.00 y restaría del total del carrito.",
      ],
      defense: [
        "`validate.int` exige un número entero entre 1 y 10 en cada línea; también rechaza decimales, textos y valores vacíos.",
        "Si el mismo producto viene en varias líneas, las cantidades se suman y se vuelve a comprobar el máximo de 10 unidades.",
        "La petición se rechaza antes de calcular importes o de tocar el inventario.",
      ],
      expect: "`400` «cantidad debe ser un entero entre 1 y 10».",
      code: "netlify/lib/orders.mjs · netlify/lib/validate.mjs",
      run: async () => {
        const r = await request("/api/cart/quote", json({ items: [{ productId: "cafe-huehue", qty: -5 }] }));
        return { pass: r.status === 400, status: r.status, detail: r.data.error };
      },
    },
    {
      id: "T04", name: "Leer el pedido de otro cliente (IDOR)",
      goal: "Ver la dirección, el teléfono y las compras de otra persona cambiando el identificador del pedido en la URL (referencia directa insegura a objetos).",
      attack: [
        "Con la sesión de `cliente@tienda.test`, pide `GET /api/orders/demo-pedido-cliente2`, un pedido que pertenece a `cliente2@tienda.test`.",
        "Equivale a cambiar el número de pedido en la barra de direcciones de «Mis pedidos».",
      ],
      defense: [
        "La ruta exige sesión: sin una cookie válida responde `401`.",
        "`loadOrderFor` compara el dueño del pedido con el usuario de la sesión. Solo pasan el titular y los roles con permiso `orders:manage` (operador y administrador).",
        "Si no corresponde, responde `404` «Pedido no encontrado», igual que para un pedido inexistente: el atacante no puede saber si el pedido existe.",
        "El intento queda registrado en la bitácora.",
      ],
      expect: "`404` como cliente y `401` sin sesión. Con cliente2, operador o administrador responde `200` porque el acceso es legítimo.",
      evidence: "Administración → Auditoría: «Acceso denegado»",
      code: "netlify/lib/routes/shop.mjs · netlify/lib/auth.mjs",
      run: async () => {
        const r = await request("/api/orders/demo-pedido-cliente2");
        const legit = user && (user.email === "cliente2@tienda.test" || user.role !== "cliente");
        if (!user) return { pass: r.status === 401, status: r.status, detail: "Sin sesión: 401" };
        if (legit) return { pass: r.status === 200, status: r.status, detail: "Tu rol/titularidad sí permite verlo (acceso legítimo)" };
        return { pass: r.status === 404, status: r.status, detail: "Respuesta 404 uniforme; el intento quedó en auditoría" };
      },
    },
    {
      id: "T04", name: "Escalar privilegios: listar usuarios como cliente",
      goal: "Usar una función de administrador llamando directo a la API, aunque el menú no le muestre esa opción a un cliente.",
      attack: [
        "Llama `GET /api/admin/users`, que devuelve todas las cuentas con su rol.",
        "No pasa por la interfaz: ocultar el botón del menú no protege nada si la API no verifica el permiso.",
      ],
      defense: [
        "La ruta declara el permiso `users:manage`, que solo tiene el rol administrador.",
        "Antes de ejecutar la ruta, `api.mjs` comprueba la sesión (`401`) y luego `can(usuario, permiso)` (`403`).",
        "El rol se lee del registro del usuario en el servidor; nada de lo que envía el navegador puede cambiarlo.",
        "La denegación queda registrada en la bitácora.",
      ],
      expect: "`403` como cliente u operador, `401` sin sesión y `200` solo como administrador.",
      evidence: "Administración → Auditoría: «Acceso denegado»",
      code: "netlify/functions/api.mjs · netlify/lib/auth.mjs",
      run: async () => {
        const r = await request("/api/admin/users");
        if (user?.role === "admin") return { pass: r.status === 200, status: r.status, detail: "Eres administrador: acceso legítimo" };
        return { pass: [401, 403].includes(r.status), status: r.status, detail: r.data.error };
      },
    },
    {
      id: "T09", name: "Webhook de pago falsificado",
      goal: "Marcar un pedido como pagado sin pagar, haciéndose pasar por la pasarela de pagos.",
      attack: [
        "Arma un aviso `payment.succeeded` con un identificador de evento inventado.",
        "Lo envía a `POST /api/payments/webhook` con la cabecera `Sandbox-Signature`: marca de tiempo actual y una firma inventada (`v1=deadbeef`).",
        "Sin la clave secreta de la pasarela no hay forma de calcular la firma correcta.",
      ],
      defense: [
        "Esta ruta no usa sesión ni token CSRF porque la llama un servidor, no un navegador: la firma es su única credencial.",
        "El servidor calcula HMAC-SHA256 de la marca de tiempo unida al cuerpo exacto, con una clave derivada solo para webhooks, y la compara en tiempo constante. Si no coincide → `401`.",
        "Aun con una firma válida: se rechazan firmas de más de 5 minutos, cada evento se procesa una sola vez y el monto y la moneda deben coincidir con los del pedido.",
        "El rechazo queda registrado en la bitácora.",
      ],
      expect: "`401` «Webhook rechazado»; el pedido no cambia de estado.",
      evidence: "Administración → Auditoría: «Aviso de pago rechazado»",
      code: "netlify/lib/routes/payments.mjs · netlify/lib/crypto.mjs",
      run: async () => {
        const fake = JSON.stringify({ id: "evt_falsificado123456", type: "payment.succeeded", data: { orderId: "x", amount: 1, currency: "GTQ" } });
        const r = await request("/api/payments/webhook", { method: "POST", csrf: false, body: fake, headers: { "Sandbox-Signature": `t=${Math.floor(Date.now() / 1000)},v1=deadbeef` } });
        return { pass: r.status === 401, status: r.status, detail: "Firma HMAC inválida → rechazado y auditado" };
      },
    },
    {
      id: "T13", name: "Petición de cambio sin token CSRF",
      goal: "Que una página maliciosa haga cambios en la cuenta de la víctima aprovechando que tiene la sesión abierta (CSRF).",
      attack: [
        "Con la sesión iniciada, envía `POST /api/addresses` para guardar una dirección nueva, pero sin la cabecera `X-CSRF-Token`.",
        "Reproduce lo que haría otro sitio: el navegador adjunta la cookie de sesión, pero el atacante no conoce el token.",
      ],
      defense: [
        "Toda petición que cambia datos pasa por `checkCsrf` antes de leer el cuerpo.",
        "Revisa `Origin` y `Sec-Fetch-Site`: un origen ajeno recibe `403` «Origen no permitido».",
        "Exige `Content-Type: application/json`, que un formulario HTML de otro sitio no puede enviar sin permiso CORS (`415`).",
        "Compara `X-CSRF-Token` con el token guardado en la sesión del servidor; si falta o no coincide → `403`.",
        "Además, la cookie es `SameSite=Strict`: en un ataque real desde otro sitio el navegador ni siquiera la enviaría.",
      ],
      expect: "`403` «Token CSRF inválido o ausente». Sin sesión responde `401`.",
      evidence: "Administración → Auditoría: «Petición sin token CSRF»",
      code: "netlify/functions/api.mjs · netlify/lib/http.mjs",
      run: async () => {
        const r = await request("/api/addresses", { method: "POST", csrf: false, body: { name: "CSRF", line1: "Calle falsa 123", city: "X", phone: "55555555" } });
        if (!user) return { pass: r.status === 401, status: r.status, detail: "Sin sesión: 401 (inicia sesión para probar CSRF)" };
        return { pass: r.status === 403, status: r.status, detail: r.data.error };
      },
    },
    {
      id: "T13", name: "Cookie de sesión inaccesible desde JavaScript",
      goal: "Robar la sesión con un script inyectado que lea `document.cookie` y se la envíe al atacante.",
      attack: [
        "Desde JavaScript de la propia página lee `document.cookie`.",
        "Busca la cookie de sesión (`__Host-sid` en HTTPS, `sid` en local).",
      ],
      defense: [
        "El servidor crea la cookie con `HttpOnly`: el navegador la envía en cada petición, pero no se la muestra a JavaScript.",
        "Con `SameSite=Strict` no viaja en peticiones que vienen de otros sitios. En HTTPS también lleva `Secure` y el prefijo `__Host-`: solo viaja cifrada y solo a este dominio.",
        "El token es aleatorio de 256 bits y el servidor guarda solo su hash SHA-256: ni con acceso al almacén se puede reconstruir la cookie.",
      ],
      expect: "La cookie no aparece en `document.cookie`. Es una comprobación en el navegador, sin petición HTTP.",
      code: "netlify/lib/http.mjs · netlify/lib/auth.mjs",
      run: async () => {
        const visible = /(^|;\s*)(__Host-)?sid=/.test(document.cookie);
        return { pass: !visible, status: "—", detail: visible ? "¡La cookie es legible!" : `document.cookie no expone la sesión (HttpOnly)${user ? "" : " — inicia sesión para una prueba completa"}` };
      },
    },
    {
      id: "T08", name: "Búsqueda con carga de inyección",
      goal: "Que el servidor ejecute código del atacante contra la base de datos a través del buscador (inyección SQL).",
      attack: [
        "Busca `' OR 1=1 --` con `GET /api/products?q=…`.",
        "En una consulta SQL armada pegando texto, la comilla cerraría la cadena, `OR 1=1` haría la condición siempre verdadera y `--` anularía el resto: devolvería todo el catálogo.",
      ],
      defense: [
        "La búsqueda se valida: máximo 60 caracteres y sin caracteres de control.",
        "Nunca se convierte en una consulta: se compara como texto literal contra el nombre y la descripción de cada producto.",
        "Solo se devuelven productos activos y únicamente sus campos públicos.",
      ],
      expect: "`200` con 0 resultados: se buscó la cadena tal cual.",
      code: "netlify/lib/routes/shop.mjs · netlify/lib/validate.mjs",
      run: async () => {
        const r = await request(`/api/products?q=${encodeURIComponent("' OR 1=1 --")}`);
        return { pass: r.ok && r.data.products.length === 0, status: r.status, detail: `Tratado como texto literal: ${r.data.products?.length ?? "?"} resultados` };
      },
    },
    {
      id: "T07", name: "Carga XSS renderizada",
      goal: "Que una reseña con HTML ejecute JavaScript en el navegador de cualquier visitante (XSS almacenado).",
      attack: [
        "Usa la carga `<img src=x onerror=alert('XSS')>`: una imagen que no existe y que ejecuta código cuando falla su carga.",
        "Crea un párrafo y le asigna la carga como texto (`textContent`), que es como React muestra el texto de una reseña.",
        "Revisa si el navegador creó un elemento `<img>` real.",
      ],
      defense: [
        "React escapa todo el texto: `<` y `>` se muestran como caracteres y nunca se interpretan como HTML. El proyecto no usa `dangerouslySetInnerHTML` en ningún lugar.",
        "La CSP de producción (`script-src 'self'`) bloquea scripts en línea y atributos como `onerror`, por si algún día se colara HTML.",
        "El servidor guarda la reseña tal cual (máximo 500 caracteres): la defensa está en cómo se muestra, no en filtrar lo que se escribe.",
      ],
      expect: "No se crea ningún `<img>`: la carga se ve como texto. Es una comprobación en el navegador; para probarlo de punta a punta, publica esa misma reseña en un producto.",
      code: "src/pages/Product.jsx · vite.config.js",
      run: async () => {
        const payload = "<img src=x onerror=alert('XSS')>";
        const el = document.createElement("p");
        el.textContent = payload;
        return { pass: el.querySelector("img") === null, status: "—", detail: `Se muestra como texto: ${payload}` };
      },
    },
    {
      id: "T01", name: "Fuerza bruta: 6 intentos contra una cuenta",
      goal: "Adivinar la contraseña de una cuenta probando muchas combinaciones (fuerza bruta).",
      attack: [
        "Genera un correo de víctima al azar (`victima-xxxxxx@tienda.test`) para no bloquear las cuentas demo.",
        "Envía 6 `POST /api/auth/login` seguidos con contraseñas incorrectas.",
        "Anota el código HTTP de cada intento.",
      ],
      defense: [
        "Antes de verificar la contraseña, el servidor revisa los contadores de la ventana de 15 minutos: 5 fallos por IP y cuenta, 20 fallos por cuenta desde cualquier IP y 30 intentos por IP.",
        "Cada fallo suma al contador; los inicios de sesión correctos no lo consumen.",
        "El error siempre dice «Correo o contraseña incorrectos» y, si la cuenta no existe, igual se calcula un scrypt ficticio: ni el mensaje ni el tiempo de respuesta revelan si el correo está registrado.",
        "Al llegar al límite responde `429` con la cabecera `Retry-After` y registra el bloqueo.",
      ],
      expect: "`401 401 401 401 401 429`: el sexto intento ya ni siquiera se evalúa.",
      evidence: "Administración → Auditoría: «Inicio de sesión fallido» y «Bloqueo por exceso de solicitudes»",
      code: "netlify/lib/routes/auth.mjs · netlify/lib/ratelimit.mjs",
      run: async () => {
        const email = `victima-${Math.random().toString(36).slice(2, 8)}@tienda.test`;
        const codes = [];
        for (let i = 0; i < 6; i++) {
          const r = await request("/api/auth/login", { ...json({ email, password: `incorrecta-${i}` }), csrf: true });
          codes.push(r.status);
        }
        return { pass: codes[5] === 429, status: codes.join(" "), detail: "Los primeros 5 → 401, el sexto → 429 (bloqueado 15 min)" };
      },
    },
    {
      id: "T14", name: "Dos compras simultáneas de la última unidad",
      needsClient: true,
      goal: "Comprar la última unidad desde dos peticiones simultáneas para que ambas se confirmen (condición de carrera que provoca sobreventa).",
      attack: [
        "Con sesión de cliente, prepara un pedido de 1 «Jade tallado — edición limitada», que tiene 1 unidad en inventario.",
        "Lanza dos `POST /api/orders` idénticos al mismo tiempo, buscando que ambos lean «queda 1» antes de que el otro la descuente.",
        "Cuenta cuántos pedidos se crearon (`201`) y después cancela los pedidos de prueba para devolver la unidad.",
      ],
      defense: [
        "`reserveStock` descuenta el inventario con `mutateJSON`, que lee el producto junto con su versión (ETag).",
        "Escribe con `onlyIfMatch`: si otra petición cambió el stock en medio, la escritura falla y se reintenta con el valor actualizado.",
        "Al releer, el stock ya es 0 y la segunda compra recibe `409` «Sin existencias suficientes».",
        "Si un pedido trae varios productos y uno falla, se devuelven las unidades que ya se habían reservado de los demás.",
      ],
      expect: "`201 / 409` (o `409 / 409` si ya no quedaba stock); nunca dos `201`. En local el emulador de Netlify Blobs no es atómico: verifícala en el sitio desplegado.",
      code: "netlify/lib/orders.mjs · netlify/lib/store.mjs",
      run: async () => {
        if (!user) return { pass: false, status: "—", detail: "Inicia sesión como cliente para ejecutar esta prueba" };
        const body = { items: [{ productId: "edicion-limitada", qty: 1 }], address: { name: "Prueba", line1: "Laboratorio 123", city: "Guatemala", phone: "55555555" } };
        const [a, b] = await Promise.all([request("/api/orders", json(body)), request("/api/orders", json(body))]);
        const created = [a, b].filter((r) => r.status === 201);
        for (const r of created) await request(`/api/orders/${r.data.order.id}/cancel`, json({}));
        return {
          pass: created.length <= 1,
          status: `${a.status} / ${b.status}`,
          detail: created.length === 1 ? "Solo una compra obtuvo la unidad; la otra recibió 409 (pedido de prueba cancelado después)" : created.length === 0 ? "Sin stock disponible: ambas 409 (no hubo sobreventa)" : "¡Sobreventa detectada!",
        };
      },
    },
    {
      id: "Hardening", name: "Cabeceras de seguridad HTTP",
      goal: "Comprobar que el sitio le ordena al navegador bloquear ataques comunes: clickjacking, scripts de terceros, conexiones sin HTTPS y adivinar el tipo de un archivo.",
      attackTitle: "Cómo se comprueba",
      attack: [
        "Pide la página principal `/` sin caché, como cualquier navegador.",
        "Revisa que la respuesta traiga 6 cabeceras: CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` y `Permissions-Policy`.",
      ],
      defense: [
        "`netlify.toml` agrega a todo el sitio: HSTS (solo HTTPS durante 2 años), `nosniff`, `X-Frame-Options: DENY` contra clickjacking, `Referrer-Policy` y `Permissions-Policy` (sin cámara, micrófono ni ubicación).",
        "Al compilar, `vite.config.js` genera `dist/_headers` con la CSP estricta: scripts, estilos e imágenes solo del propio sitio y `frame-ancestors 'none'`.",
        "Con esas reglas el navegador se niega a mostrar la tienda dentro de un `<iframe>` ajeno, no ejecuta scripts de otros dominios y no vuelve a conectarse por HTTP.",
      ],
      expect: "`200` con las 6 cabeceras. En `pnpm dev` la CSP no se aplica: usa `pnpm serve` o el sitio desplegado.",
      code: "netlify.toml · vite.config.js",
      run: async () => {
        const r = await fetch("/", { cache: "no-store" });
        const want = ["content-security-policy", "strict-transport-security", "x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy"];
        const missing = want.filter((h) => !r.headers.get(h));
        return { pass: missing.length === 0, status: r.status, detail: missing.length ? `Faltan: ${missing.join(", ")}` : "CSP, HSTS, nosniff, X-Frame-Options, Referrer-Policy y Permissions-Policy presentes" };
      },
    },
  ];
}

function LabSteps({ test, id }) {
  return (
    <div className="lab-steps" id={id}>
      <p className="lab-goal"><span>Qué intenta el atacante</span>{rich(test.goal)}</p>
      <div className="lab-columns">
        <div className="lab-col attack">
          <h4>{test.attackTitle ?? "Cómo se ataca"}</h4>
          <ol>{test.attack.map((s, i) => <li key={i}>{rich(s)}</li>)}</ol>
        </div>
        <div className="lab-col defense">
          <h4>Cómo se defiende</h4>
          <ol>{test.defense.map((s, i) => <li key={i}>{rich(s)}</li>)}</ol>
        </div>
      </div>
      <dl>
        <dt>Resultado esperado</dt><dd>{rich(test.expect)}</dd>
        {test.evidence && <><dt>Dónde verlo</dt><dd>{test.evidence}</dd></>}
        <dt>Código</dt><dd><code>{test.code}</code></dd>
      </dl>
    </div>
  );
}

export default function Security() {
  const { user } = useAuth();
  const tests = useTests(user);
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState(() => new Set());

  const toggle = (i) =>
    setOpen((o) => {
      const n = new Set(o);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  const allOpen = open.size === tests.length;
  const toggleAll = () => setOpen(allOpen ? new Set() : new Set(tests.map((_, i) => i)));

  const runOne = async (i) => {
    setResults((r) => ({ ...r, [i]: { running: true } }));
    try {
      const res = await tests[i].run();
      setResults((r) => ({ ...r, [i]: res }));
    } catch (e) {
      setResults((r) => ({ ...r, [i]: { pass: false, status: "error", detail: e.message } }));
    }
  };
  const runAll = async () => {
    setRunning(true);
    for (let i = 0; i < tests.length; i++) await runOne(i);
    setRunning(false);
  };

  const done = Object.values(results).filter((r) => r && !r.running);
  const passed = done.filter((r) => r.pass).length;

  return (
    <>
      <section className="sec-hero">
        <span className="eyebrow"><span className="dot" /> Seguridad verificable</span>
        <h1>Atácala tú mismo. <span className="gradient-text">Debería resistir.</span></h1>
        <p>Controles implementados para las 14 amenazas STRIDE del Entregable 1, con trazabilidad a OWASP ASVS 5.0.0. El laboratorio lanza ataques reales contra la API desplegada.</p>
        <div className="score">
          <div><b>{done.length ? `${passed}/${done.length}` : "—"}</b><span>ataques bloqueados</span></div>
          <div><b>14</b><span>amenazas cubiertas</span></div>
          <div><b>7</b><span>capas de defensa</span></div>
        </div>
      </section>

      <section className="panel" id="laboratorio">
        <div className="row between">
          <h2>Laboratorio de pruebas</h2>
          <div className="row">
            <button className="btn ghost" onClick={toggleAll}>{allOpen ? "Ocultar pasos" : "Ver todos los pasos"}</button>
            <button className="btn" onClick={runAll} disabled={running}>{running ? "Ejecutando…" : "Ejecutar todas"}</button>
          </div>
        </div>
        <p className="muted">
          Cada prueba lanza un ataque real contra la API desplegada y verifica que sea bloqueado.
          Abre «Ver pasos» en cualquier prueba para ver cómo se ejecuta el ataque y qué hace la tienda para detenerlo.
          {user ? ` Sesión actual: ${user.email}.` : <> Algunas pruebas requieren <Link to="/login?next=/seguridad">iniciar sesión</Link> (usa cliente@tienda.test).</>}
        </p>
        <p className="hint">Cada intento bloqueado queda registrado. Con la cuenta de administrador puedes verlos aparecer en tiempo real en <Link to="/admin/auditoria">Administración → Auditoría</Link>.</p>
        <div className="scroll-x lab-scroll"><table className="table">
          <thead><tr><th>Amenaza</th><th>Prueba</th><th>HTTP</th><th>Resultado</th><th></th></tr></thead>
          <tbody>
            {tests.map((t, i) => {
              const r = results[i];
              const isOpen = open.has(i);
              return (
                <Fragment key={i}>
                  <tr className={`lab-row ${isOpen ? "open" : ""}`}>
                    <td><span className="tag">{t.id}</span></td>
                    <td>
                      {t.name}
                      {r?.detail && <div className="muted small">{r.detail}</div>}
                      <button className="lab-toggle" onClick={() => toggle(i)} aria-expanded={isOpen} aria-controls={`lab-steps-${i}`}>
                        {isOpen ? "Ocultar pasos ▲" : "Ver pasos ▼"}
                      </button>
                    </td>
                    <td>{r?.status !== undefined && <code>{r.status}</code>}</td>
                    <td>{r?.running ? "…" : r ? (r.pass ? <span className="result-pass">🛡️ Bloqueado</span> : <span className="result-fail">Revisar</span>) : ""}</td>
                    <td><button className="btn ghost sm" onClick={() => runOne(i)} disabled={running || r?.running}>Probar</button></td>
                  </tr>
                  {isOpen && (
                    <tr className="lab-detail">
                      <td colSpan={5}><LabSteps test={t} id={`lab-steps-${i}`} /></td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table></div>
      </section>

      <section className="panel" id="arquitectura">
        <h2>Arquitectura y fronteras de confianza</h2>
        <p className="muted">Toca una frontera (F1–F5) para ver qué datos la cruzan y qué controles la protegen.</p>
        <TrustDiagram />
      </section>

      <section className="panel" id="controles">
        <h2>Matriz de controles</h2>
        <p className="muted">Las 14 amenazas del modelo STRIDE explicadas en lenguaje sencillo: qué podría pasar, cómo lo evitamos y dónde comprobarlo.</p>
        <ControlsMatrix />
      </section>
    </>
  );
}
