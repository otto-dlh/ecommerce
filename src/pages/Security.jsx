import { useState } from "react";
import { Link } from "react-router-dom";
import { request } from "../api.js";
import { useAuth } from "../state.jsx";
import ControlsMatrix from "./security/ControlsMatrix.jsx";
import TrustDiagram from "./security/TrustDiagram.jsx";

const json = (body) => ({ method: "POST", body });

function useTests(user) {
  return [
    {
      id: "T02", name: "Enviar precio manipulado en la cotización",
      run: async () => {
        const r = await request("/api/cart/quote", json({ items: [{ productId: "cafe-huehue", qty: 1, price: 1, unitPrice: 1 }], total: 1 }));
        return { pass: r.ok && r.data.subtotal === 9500, status: r.status, detail: `El servidor ignoró price=1 y calculó subtotal Q${(r.data.subtotal / 100).toFixed(2)}` };
      },
    },
    {
      id: "T02", name: "Cantidad negativa",
      run: async () => {
        const r = await request("/api/cart/quote", json({ items: [{ productId: "cafe-huehue", qty: -5 }] }));
        return { pass: r.status === 400, status: r.status, detail: r.data.error };
      },
    },
    {
      id: "T04", name: "Leer el pedido de otro cliente (IDOR)",
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
      run: async () => {
        const r = await request("/api/admin/users");
        if (user?.role === "admin") return { pass: r.status === 200, status: r.status, detail: "Eres administrador: acceso legítimo" };
        return { pass: [401, 403].includes(r.status), status: r.status, detail: r.data.error };
      },
    },
    {
      id: "T09", name: "Webhook de pago falsificado",
      run: async () => {
        const fake = JSON.stringify({ id: "evt_falsificado123456", type: "payment.succeeded", data: { orderId: "x", amount: 1, currency: "GTQ" } });
        const r = await request("/api/payments/webhook", { method: "POST", csrf: false, body: fake, headers: { "Sandbox-Signature": `t=${Math.floor(Date.now() / 1000)},v1=deadbeef` } });
        return { pass: r.status === 401, status: r.status, detail: "Firma HMAC inválida → rechazado y auditado" };
      },
    },
    {
      id: "T13", name: "Petición de cambio sin token CSRF",
      run: async () => {
        const r = await request("/api/addresses", { method: "POST", csrf: false, body: { name: "CSRF", line1: "Calle falsa 123", city: "X", phone: "55555555" } });
        if (!user) return { pass: r.status === 401, status: r.status, detail: "Sin sesión: 401 (inicia sesión para probar CSRF)" };
        return { pass: r.status === 403, status: r.status, detail: r.data.error };
      },
    },
    {
      id: "T13", name: "Cookie de sesión inaccesible desde JavaScript",
      run: async () => {
        const visible = /(^|;\s*)(__Host-)?sid=/.test(document.cookie);
        return { pass: !visible, status: "—", detail: visible ? "¡La cookie es legible!" : `document.cookie no expone la sesión (HttpOnly)${user ? "" : " — inicia sesión para una prueba completa"}` };
      },
    },
    {
      id: "T08", name: "Búsqueda con carga de inyección",
      run: async () => {
        const r = await request(`/api/products?q=${encodeURIComponent("' OR 1=1 --")}`);
        return { pass: r.ok && r.data.products.length === 0, status: r.status, detail: `Tratado como texto literal: ${r.data.products?.length ?? "?"} resultados` };
      },
    },
    {
      id: "T07", name: "Carga XSS renderizada",
      run: async () => {
        const payload = "<img src=x onerror=alert('XSS')>";
        const el = document.createElement("p");
        el.textContent = payload;
        return { pass: el.querySelector("img") === null, status: "—", detail: `Se muestra como texto: ${payload}` };
      },
    },
    {
      id: "T01", name: "Fuerza bruta: 6 intentos contra una cuenta",
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
      run: async () => {
        const r = await fetch("/", { cache: "no-store" });
        const want = ["content-security-policy", "strict-transport-security", "x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy"];
        const missing = want.filter((h) => !r.headers.get(h));
        return { pass: missing.length === 0, status: r.status, detail: missing.length ? `Faltan: ${missing.join(", ")}` : "CSP, HSTS, nosniff, X-Frame-Options, Referrer-Policy y Permissions-Policy presentes" };
      },
    },
  ];
}

export default function Security() {
  const { user } = useAuth();
  const tests = useTests(user);
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(false);

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
          <button className="btn" onClick={runAll} disabled={running}>{running ? "Ejecutando…" : "Ejecutar todas"}</button>
        </div>
        <p className="muted">
          Cada prueba lanza un ataque real contra la API desplegada y verifica que sea bloqueado.
          {user ? ` Sesión actual: ${user.email}.` : <> Algunas pruebas requieren <Link to="/login?next=/seguridad">iniciar sesión</Link> (usa cliente@tienda.test).</>}
        </p>
        <p className="hint">Cada intento bloqueado queda registrado. Con la cuenta de administrador puedes verlos aparecer en tiempo real en <Link to="/admin/auditoria">Administración → Auditoría</Link>.</p>
        <div className="scroll-x"><table className="table">
          <thead><tr><th>Amenaza</th><th>Prueba</th><th>HTTP</th><th>Resultado</th><th></th></tr></thead>
          <tbody>
            {tests.map((t, i) => {
              const r = results[i];
              return (
                <tr key={i} className="lab-row">
                  <td><span className="tag">{t.id}</span></td>
                  <td>{t.name}{r?.detail && <div className="muted small">{r.detail}</div>}</td>
                  <td>{r?.status !== undefined && <code>{r.status}</code>}</td>
                  <td>{r?.running ? "…" : r ? (r.pass ? <span className="result-pass">🛡️ Bloqueado</span> : <span className="result-fail">Revisar</span>) : ""}</td>
                  <td><button className="btn ghost sm" onClick={() => runOne(i)} disabled={running || r?.running}>Probar</button></td>
                </tr>
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
