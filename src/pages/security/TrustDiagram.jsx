import { useState } from "react";

// Fronteras de confianza F1–F5 (Figura 1 del Entregable 1) adaptadas al despliegue en Netlify + InsForge.
// F6 es nueva: el navegador escucha eventos realtime de InsForge sin pasar por la API.
const BOUNDARIES = {
  F1: {
    title: "Navegador ↔ CDN de Netlify",
    zone: "Internet público",
    crosses: "Peticiones HTTPS de clientes y administradores, con la cookie de sesión.",
    controls: [
      "TLS gestionado por Netlify + HSTS con preload",
      "Content-Security-Policy estricta (sin scripts en línea)",
      "Cookie de sesión HttpOnly, Secure y SameSite=Strict",
      "X-Frame-Options: DENY y Permissions-Policy restrictiva",
    ],
    threats: ["T01", "T05", "T07", "T13"],
  },
  F2: {
    title: "CDN ↔ API de la tienda",
    zone: "Entrada a la lógica de negocio",
    crosses: "Solicitudes a /api/* con cookie de sesión y token CSRF.",
    controls: [
      "Límite de solicitudes por conexión y por operación sensible",
      "Verificación de sesión, token CSRF y origen en cada cambio",
      "Validación de todos los datos en el servidor (lista blanca de campos)",
      "Cuerpos de hasta 16 KB y errores genéricos sin detalles internos",
    ],
    threats: ["T01", "T02", "T04", "T05", "T13"],
  },
  F3: {
    title: "API ↔ InsForge (PostgreSQL y Storage)",
    zone: "Datos privados",
    crosses: "Consultas HTTPS con la clave de administrador (solo en el servidor): usuarios, sesiones, pedidos, inventario, imágenes y bitácora.",
    controls: [
      "Seguridad por filas activa y sin permisos para las claves públicas",
      "Transacciones con SELECT … FOR UPDATE: el pedido se reserva completo o no se reserva",
      "Tokens de sesión guardados solo como hash SHA-256 y secretos MFA cifrados",
      "Bitácora con firma HMAC y trigger que impide modificar o borrar registros",
    ],
    threats: ["T03", "T04", "T08", "T10", "T12", "T14"],
  },
  F4: {
    title: "API ↔ Pasarela de pagos",
    zone: "Proveedor externo",
    crosses: "La tarjeta va directo a la pasarela; la pasarela confirma el pago a la API con un aviso (webhook).",
    controls: [
      "La tienda nunca recibe el número completo ni el CVV",
      "Aviso firmado con HMAC-SHA256 y válido por 5 minutos",
      "Cada aviso se procesa una sola vez (idempotencia)",
      "El monto y el estado del pedido deben coincidir",
    ],
    threats: ["T09"],
  },
  F5: {
    title: "Repositorio y pipeline ↔ Ejecución",
    zone: "Cadena de entrega",
    crosses: "Código, dependencias y artefactos que llegan de Git a producción.",
    controls: [
      "pnpm: versiones con al menos 24 h publicadas y scripts de instalación bloqueados",
      "Lockfile con versiones exactas y build reproducible",
      "Secretos en variables de entorno de Netlify, fuera del código",
      "Despliegue solo desde la rama protegida",
    ],
    threats: ["T06", "T10", "T11"],
  },
  F6: {
    title: "Navegador ↔ Realtime de InsForge",
    zone: "Canal en vivo",
    crosses: "WebSocket con la clave anónima (pública por diseño) para recibir avisos en vivo, y fotos de producto del bucket público.",
    controls: [
      "El aviso es solo una señal (ids y estado); los datos se piden a la API, que autoriza",
      "Canal privado por sesión con id aleatorio de 128 bits; se cierra al revocar la sesión",
      "Nadie puede publicar desde el navegador (sin política de escritura en realtime)",
      "La clave anónima no lee tablas ni ejecuta funciones de la base de datos",
    ],
    threats: ["T04", "T09", "T12"],
  },
};

function Node({ x, y, w, h, icon, title, lines = [], tone = "" }) {
  return (
    <g className={`td-node ${tone}`}>
      <rect x={x} y={y} width={w} height={h} rx="14" />
      <text x={x + w / 2} y={y + 30} className="td-title">{icon} {title}</text>
      {lines.map((l, i) => (
        <text key={l} x={x + w / 2} y={y + 52 + i * 17} className="td-sub">{l}</text>
      ))}
    </g>
  );
}

function Boundary({ id, x1, y1, x2, y2, lx, ly, active, onSelect }) {
  const select = () => onSelect(id);
  return (
    <g
      className={`td-boundary ${active ? "active" : ""}`}
      role="button"
      tabIndex={0}
      aria-pressed={active}
      aria-label={`Frontera ${id}: ${BOUNDARIES[id].title}`}
      onClick={select}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), select())}
    >
      <line x1={x1} y1={y1} x2={x2} y2={y2} className="td-hit" />
      <line x1={x1} y1={y1} x2={x2} y2={y2} className="td-line" />
      <rect x={lx - 19} y={ly - 13} width="38" height="26" rx="13" className="td-pill" />
      <text x={lx} y={ly + 5} className="td-pill-text">{id}</text>
    </g>
  );
}

export default function TrustDiagram() {
  const [selected, setSelected] = useState("F2");
  const b = BOUNDARIES[selected];

  return (
    <div className="trust">
      <div className="trust-chips" role="tablist" aria-label="Fronteras de confianza">
        {Object.entries(BOUNDARIES).map(([id, info]) => (
          <button key={id} role="tab" aria-selected={selected === id} className={`chip ${selected === id ? "active" : ""}`} onClick={() => setSelected(id)}>
            {id} · {info.zone}
          </button>
        ))}
      </div>

      <div className="trust-canvas">
        <svg viewBox="0 -44 880 474" role="img" aria-label="Arquitectura de Tienda Segura con fronteras de confianza F1 a F6">
          <defs>
            <marker id="td-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className="td-arrowhead" />
            </marker>
          </defs>

          {/* Zonas */}
          <rect x="8" y="20" width="184" height="260" rx="18" className="td-zone" />
          <text x="100" y="42" className="td-zone-label">INTERNET</text>
          <rect x="208" y="20" width="184" height="260" rx="18" className="td-zone" />
          <text x="300" y="42" className="td-zone-label">PERÍMETRO NETLIFY</text>
          <rect x="408" y="20" width="234" height="260" rx="18" className="td-zone app" />
          <text x="525" y="42" className="td-zone-label">APLICACIÓN</text>
          <rect x="658" y="20" width="214" height="230" rx="18" className="td-zone data" />
          <text x="765" y="42" className="td-zone-label">DATOS PRIVADOS</text>
          <rect x="658" y="280" width="214" height="140" rx="18" className="td-zone ext" />
          <text x="765" y="302" className="td-zone-label">EXTERNO</text>
          <rect x="208" y="310" width="434" height="110" rx="18" className="td-zone build" />
          <text x="300" y="332" className="td-zone-label">CADENA DE ENTREGA</text>

          {/* Componentes */}
          <Node x={20} y={110} w={160} h={92} icon="🧑‍💻" title="Navegador" lines={["Cliente / Admin", "React SPA"]} />
          <Node x={220} y={110} w={160} h={92} icon="🌐" title="CDN Netlify" lines={["TLS · cabeceras", "CSP"]} />
          <Node x={430} y={75} w={190} h={160} icon="⚙️" title="Función api" lines={["Sesión · CSRF", "Permisos por rol", "Validación", "Auditoría"]} tone="core" />
          <Node x={680} y={75} w={170} h={160} icon="🗄️" title="InsForge" lines={["PostgreSQL · RLS", "Pedidos · stock", "Bitácora firmada", "Storage · Realtime"]} />
          <Node x={680} y={315} w={170} h={92} icon="💳" title="Pasarela" lines={["Sandbox externo", "Tokeniza la tarjeta"]} />
          <Node x={230} y={345} w={180} h={64} icon="📦" title="Git + Build" lines={["pnpm · lockfile"]} />

          {/* Flujos */}
          <path d="M180,156 L220,156" className="td-link" markerEnd="url(#td-arrow)" markerStart="url(#td-arrow)" />
          <path d="M380,156 L430,156" className="td-link" markerEnd="url(#td-arrow)" markerStart="url(#td-arrow)" />
          <path d="M620,155 L680,155" className="td-link" markerEnd="url(#td-arrow)" markerStart="url(#td-arrow)" />
          <path d="M680,360 C640,360 600,300 560,235" className="td-link" markerEnd="url(#td-arrow)" />
          <text x="572" y="384" className="td-link-label">webhook firmado</text>
          <path d="M410,377 C480,377 520,320 520,235" className="td-link dashed" markerEnd="url(#td-arrow)" />
          <text x="470" y="398" className="td-link-label">despliegue</text>
          <path d="M830,75 L830,-16 L50,-16 L50,110" className="td-link dashed" markerEnd="url(#td-arrow)" />
          <text x="430" y="-24" className="td-link-label">WebSocket realtime (clave anónima, solo recibe)</text>

          {/* Fronteras de confianza */}
          <Boundary id="F1" x1={200} y1={60} x2={200} y2={270} lx={200} ly={86} active={selected === "F1"} onSelect={setSelected} />
          <Boundary id="F2" x1={400} y1={60} x2={400} y2={270} lx={400} ly={86} active={selected === "F2"} onSelect={setSelected} />
          <Boundary id="F3" x1={650} y1={60} x2={650} y2={245} lx={650} ly={86} active={selected === "F3"} onSelect={setSelected} />
          <Boundary id="F4" x1={650} y1={285} x2={650} y2={420} lx={650} ly={392} active={selected === "F4"} onSelect={setSelected} />
          <Boundary id="F5" x1={215} y1={295} x2={640} y2={295} lx={250} ly={295} active={selected === "F5"} onSelect={setSelected} />
          <Boundary id="F6" x1={650} y1={-38} x2={650} y2={8} lx={650} ly={-16} active={selected === "F6"} onSelect={setSelected} />
        </svg>
      </div>

      <div className="trust-detail" aria-live="polite">
        <div className="trust-detail-head">
          <span className="control-id">{selected}</span>
          <div>
            <h3>{b.title}</h3>
            <span className="muted">{b.zone}</span>
          </div>
        </div>
        <p><b>Qué cruza esta frontera:</b> {b.crosses}</p>
        <ul className="trust-controls">
          {b.controls.map((c) => <li key={c}>{c}</li>)}
        </ul>
        <div className="row">
          <span className="muted small">Amenazas que mitiga:</span>
          {b.threats.map((t) => <a key={t} href={`#control-${t}`} className="tag">{t}</a>)}
        </div>
      </div>
    </div>
  );
}
