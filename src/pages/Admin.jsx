import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { api } from "../api.js";
import { date, money, ROLE_LABEL, STATUS } from "../format.js";
import { useAuth } from "../state.jsx";
import { StatusBadge } from "./Orders.jsx";

function useLoad(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = () => api(path).then((d) => { setData(d); setError(""); }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [path]);
  return { data, error, load, setError };
}

function Dashboard() {
  const { data, error } = useLoad("/api/admin/stats");
  if (error) return <p className="alert error">{error}</p>;
  if (!data) return <p className="muted">Cargando…</p>;
  const s = data.security;
  return (
    <>
      <div className="stats">
        <div className="stat"><span>Ventas confirmadas</span><b>{money(data.revenue)}</b></div>
        <div className="stat"><span>Pedidos</span><b>{data.orders}</b></div>
        {Object.entries(data.byStatus).map(([k, n]) => <div className="stat" key={k}><span>{STATUS[k]?.label ?? k}</span><b>{n}</b></div>)}
      </div>
      <h3>Alertas de seguridad (últimas 24 h)</h3>
      <div className="stats">
        <div className={`stat ${s.loginFailures24h >= 10 ? "alarm" : ""}`}><span>Logins fallidos</span><b>{s.loginFailures24h}</b></div>
        <div className={`stat ${s.authzDenied24h ? "alarm" : ""}`}><span>Autorizaciones denegadas</span><b>{s.authzDenied24h}</b></div>
        <div className={`stat ${s.rateLimited24h ? "alarm" : ""}`}><span>Bloqueos por rate limit</span><b>{s.rateLimited24h}</b></div>
        <div className={`stat ${s.webhookRejected24h ? "alarm" : ""}`}><span>Webhooks rechazados</span><b>{s.webhookRejected24h}</b></div>
        <div className={`stat ${s.csrfRejected24h ? "alarm" : ""}`}><span>CSRF bloqueados</span><b>{s.csrfRejected24h}</b></div>
      </div>
      <h3>Inventario bajo</h3>
      {data.lowStock.length === 0 ? <p className="muted">Sin alertas.</p> : (
        <ul className="plain">{data.lowStock.map((p) => <li key={p.id}>{p.name}: <b>{p.stock}</b></li>)}</ul>
      )}
    </>
  );
}

const EMPTY_PRODUCT = { id: "", name: "", description: "", price: 10000, category: "", emoji: "📦", color: "#0f766e", active: true };

function ProductForm({ initial, onSaved, onCancel }) {
  const [p, setP] = useState(initial);
  const [error, setError] = useState("");
  const isNew = !initial.createdAt;
  const save = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const body = { name: p.name, description: p.description, price: Number(p.price), category: p.category, emoji: p.emoji, color: p.color, active: p.active };
      if (isNew) await api("/api/admin/products", { method: "POST", body: { ...body, id: p.id } });
      else await api(`/api/admin/products/${p.id}`, { method: "PUT", body });
      onSaved();
    } catch (err) { setError(err.message); }
  };
  const f = (k, label, props = {}) => <label>{label}<input value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} {...props} /></label>;
  return (
    <form className="panel form grid-form" onSubmit={save}>
      {isNew && f("id", "ID (slug)", { pattern: "[a-z0-9-]{3,40}", required: true })}
      {f("name", "Nombre", { required: true, maxLength: 80 })}
      {f("category", "Categoría", { required: true, maxLength: 40 })}
      {f("price", "Precio (centavos)", { type: "number", min: 100, required: true })}
      {f("emoji", "Emoji", { maxLength: 8 })}
      {f("color", "Color", { type: "color" })}
      <label className="span2">Descripción<textarea value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} maxLength={400} required /></label>
      <label className="check"><input type="checkbox" checked={p.active} onChange={(e) => setP({ ...p, active: e.target.checked })} /> Activo</label>
      {error && <p className="alert error span2">{error}</p>}
      <div className="row span2"><button className="btn">Guardar</button><button type="button" className="btn ghost" onClick={onCancel}>Cancelar</button></div>
    </form>
  );
}

function Products() {
  const { user } = useAuth();
  const { data, error, load } = useLoad("/api/admin/products");
  const [editing, setEditing] = useState(null);
  const [adjust, setAdjust] = useState({});
  const [msg, setMsg] = useState("");
  const isAdmin = user.role === "admin";

  const doAdjust = async (id) => {
    const a = adjust[id] || {};
    setMsg("");
    try {
      await api(`/api/admin/products/${id}/stock`, { method: "POST", body: { delta: Number(a.delta), reason: a.reason || "" } });
      setAdjust({ ...adjust, [id]: {} });
      setMsg("Inventario actualizado y registrado en auditoría.");
      load();
    } catch (e) { setMsg(e.message); }
  };

  if (error) return <p className="alert error">{error}</p>;
  if (!data) return <p className="muted">Cargando…</p>;
  return (
    <>
      {isAdmin && !editing && <button className="btn" onClick={() => setEditing(EMPTY_PRODUCT)}>+ Nuevo producto</button>}
      {editing && <ProductForm initial={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {msg && <p className="muted">{msg}</p>}
      <div className="panel scroll">
        <table className="table">
          <thead><tr><th></th><th>Producto</th><th>Precio</th><th>Stock</th><th>Ajustar inventario (cantidad + motivo)</th>{isAdmin && <th></th>}</tr></thead>
          <tbody>
            {data.products.map((p) => (
              <tr key={p.id} className={p.active ? "" : "inactive"}>
                <td>{p.emoji}</td>
                <td>{p.name}<br /><small className="muted">{p.id}{!p.active && " · inactivo"}</small></td>
                <td>{money(p.price)}</td>
                <td><b>{p.stock}</b></td>
                <td>
                  <div className="row nowrap">
                    <input type="number" className="qty" placeholder="±" value={adjust[p.id]?.delta ?? ""} onChange={(e) => setAdjust({ ...adjust, [p.id]: { ...adjust[p.id], delta: e.target.value } })} />
                    <input placeholder="Motivo" maxLength={200} value={adjust[p.id]?.reason ?? ""} onChange={(e) => setAdjust({ ...adjust, [p.id]: { ...adjust[p.id], reason: e.target.value } })} />
                    <button className="btn sm" onClick={() => doAdjust(p.id)}>Aplicar</button>
                  </div>
                </td>
                {isAdmin && <td><button className="btn ghost sm" onClick={() => setEditing(p)}>Editar</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const NEXT_LABEL = { preparando: "Preparar", enviado: "Marcar enviado", entregado: "Marcar entregado", cancelado: "Cancelar" };

function Orders() {
  const { user } = useAuth();
  const { data, error, load, setError } = useLoad("/api/admin/orders");
  const [filter, setFilter] = useState("");
  const change = async (id, status) => {
    if (status === "cancelado" && !confirm("¿Cancelar el pedido? Se devolverá el inventario.")) return;
    try { await api(`/api/admin/orders/${id}/status`, { method: "POST", body: { status } }); load(); } catch (e) { setError(e.message); }
  };
  if (!data) return error ? <p className="alert error">{error}</p> : <p className="muted">Cargando…</p>;
  const orders = filter ? data.orders.filter((o) => o.status === filter) : data.orders;
  return (
    <>
      {error && <p className="alert error">{error}</p>}
      <select value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="">Todos los estados</option>
        {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
      </select>
      <div className="panel scroll">
        <table className="table">
          <thead><tr><th>Pedido</th><th>Fecha</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td><Link to={`/pedidos/${o.id}`}>#{o.id.slice(0, 8)}</Link></td>
                <td>{date(o.createdAt)}</td>
                <td>{o.address.name}</td>
                <td>{money(o.total)}</td>
                <td><StatusBadge status={o.status} /></td>
                <td className="row nowrap">
                  {(data.transitions[o.status] || [])
                    .filter((s) => s !== "cancelado" || (user.role === "admin" && o.status !== "pendiente_pago"))
                    .map((s) => <button key={s} className={`btn sm ${s === "cancelado" ? "ghost" : ""}`} onClick={() => change(o.id, s)}>{NEXT_LABEL[s]}</button>)}
                  {o.status === "pendiente_pago" && <small className="muted">Esperando webhook de pago</small>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Users() {
  const { data, error, load, setError } = useLoad("/api/admin/users");
  const { user: me } = useAuth();
  const update = async (id, body) => {
    try { await api(`/api/admin/users/${id}`, { method: "PUT", body }); load(); } catch (e) { setError(e.message); }
  };
  if (!data) return error ? <p className="alert error">{error}</p> : <p className="muted">Cargando…</p>;
  return (
    <div className="panel scroll">
      {error && <p className="alert error">{error}</p>}
      <p className="hint">Al cambiar el rol o desactivar una cuenta se revocan todas sus sesiones activas.</p>
      <table className="table">
        <thead><tr><th>Usuario</th><th>Rol</th><th>MFA</th><th>Estado</th><th>Alta</th></tr></thead>
        <tbody>
          {data.users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}<br /><small className="muted">{u.email}</small></td>
              <td>
                <select value={u.role} disabled={u.id === me.id} onChange={(e) => update(u.id, { role: e.target.value })}>
                  {Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </td>
              <td>{u.mfaEnabled ? "✓" : "—"}</td>
              <td>
                <button className="btn ghost sm" disabled={u.id === me.id} onClick={() => update(u.id, { active: !u.active })}>
                  {u.active ? "Activo · desactivar" : "Inactivo · activar"}
                </button>
              </td>
              <td><small>{date(u.createdAt)}</small></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Nombres legibles de los eventos de la bitacora (netlify/lib/audit.mjs)
const ACTION_LABELS = {
  "auth.login": { ok: "Inicio de sesión", failure: "Inicio de sesión fallido" },
  "auth.login.mfa_challenge": "Se solicitó el segundo factor",
  "auth.mfa": { failure: "Código MFA incorrecto" },
  "auth.register": { ok: "Cuenta registrada", denied: "Registro rechazado" },
  "auth.logout": "Cierre de sesión",
  "auth.logout_all": "Cierre de todas las sesiones",
  "auth.password_change": { ok: "Cambio de contraseña", failure: "Cambio de contraseña fallido" },
  "auth.mfa_enabled": "MFA activado",
  "auth.mfa_disabled": { ok: "MFA desactivado", failure: "Intento fallido de desactivar MFA" },
  "authz.denied": "Acceso denegado",
  "ratelimit.block": "Bloqueo por exceso de solicitudes",
  "csrf.origin_rejected": "Origen no permitido",
  "csrf.token_rejected": "Petición sin token CSRF",
  "order.created": "Pedido creado",
  "order.status": "Cambio de estado de pedido",
  "payment.webhook": { ok: "Pago confirmado por la pasarela", rejected: "Aviso de pago rechazado" },
  "product.create": "Producto creado",
  "product.update": "Producto modificado",
  "stock.adjust": "Ajuste de inventario",
  "user.update": "Cambio de rol o estado de usuario",
  "review.hide": "Reseña ocultada",
};

const eventLabel = (e) => {
  const l = ACTION_LABELS[e.action];
  if (!l) return e.action;
  return typeof l === "string" ? l : l[e.outcome] ?? l.ok ?? e.action;
};
const isIncident = (e) => e.outcome !== "ok";
const COUNTERS = [
  ["Incidentes", (e) => isIncident(e)],
  ["Logins fallidos", (e) => e.action === "auth.login" && e.outcome === "failure"],
  ["Accesos denegados", (e) => e.action === "authz.denied"],
  ["Bloqueos por límite", (e) => e.action === "ratelimit.block"],
  ["CSRF bloqueados", (e) => e.action.startsWith("csrf.")],
  ["Webhooks rechazados", (e) => e.action === "payment.webhook" && e.outcome !== "ok"],
];
const POLL_MS = 4000;

function Audit() {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState("");
  const [live, setLive] = useState(true);
  const [onlyIncidents, setOnlyIncidents] = useState(false);
  const [q, setQ] = useState("");
  const [fresh, setFresh] = useState(() => new Set());
  const [updatedAt, setUpdatedAt] = useState(null);
  const seen = useRef(null);

  const load = useCallback(async () => {
    try {
      const d = await api("/api/admin/audit?limit=150");
      const ids = d.entries.map((e) => e.id);
      if (seen.current) {
        const nuevos = ids.filter((id) => !seen.current.has(id));
        if (nuevos.length) {
          setFresh(new Set(nuevos));
          setTimeout(() => setFresh(new Set()), 4000);
        }
      }
      seen.current = new Set(ids);
      setEntries(d.entries);
      setUpdatedAt(new Date());
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Sondeo periodico mientras el modo en vivo este activo y la pestana sea visible
  useEffect(() => {
    if (!live) return undefined;
    const t = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    return () => clearInterval(t);
  }, [live, load]);

  if (!entries) return error ? <p className="alert error">{error}</p> : <p className="muted">Cargando…</p>;

  const term = q.trim().toLowerCase();
  const shown = entries.filter(
    (e) => (!onlyIncidents || isIncident(e)) && (!term || `${eventLabel(e)} ${JSON.stringify(e)}`.toLowerCase().includes(term))
  );
  const tampered = entries.filter((e) => !e.integrity).length;

  return (
    <>
      <div className="audit-head">
        <div className={`live-indicator ${live ? "on" : ""}`}>
          <span className="live-dot" />
          {live ? "En vivo" : "En pausa"}
          {updatedAt && <small className="muted"> · actualizado {updatedAt.toLocaleTimeString("es-GT")}</small>}
        </div>
        <div className="row">
          <button className="btn ghost sm" onClick={() => setLive(!live)}>{live ? "⏸ Pausar" : "▶ Reanudar"}</button>
          <button className="btn ghost sm" onClick={load}>↻ Actualizar</button>
        </div>
      </div>

      <div className="stats audit-stats">
        {COUNTERS.map(([label, fn]) => {
          const n = entries.filter(fn).length;
          return (
            <div key={label} className={`stat ${n && label !== "Incidentes" ? "alarm" : ""}`}>
              <span>{label}</span>
              <b>{n}</b>
            </div>
          );
        })}
      </div>

      <div className="row between audit-filters">
        <input type="search" placeholder="Buscar (evento, usuario, detalle)…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="check-inline">
          <input type="checkbox" checked={onlyIncidents} onChange={(e) => setOnlyIncidents(e.target.checked)} /> Solo incidentes
        </label>
      </div>

      <p className={tampered ? "alert error" : "alert ok"}>
        {tampered ? `⚠ ${tampered} registros no superan la verificación HMAC: podrían haber sido alterados` : `✓ Firma HMAC verificada en los ${entries.length} registros más recientes`}
      </p>

      <div className="panel scroll">
        <table className="table small audit-table">
          <thead><tr><th>Hora</th><th>Evento</th><th>Quién</th><th>IP</th><th>Detalle</th><th>Firma</th></tr></thead>
          <tbody>
            {shown.map((e) => (
              <tr key={e.id} className={`${isIncident(e) ? "incident" : ""} ${fresh.has(e.id) ? "fresh" : ""}`}>
                <td title={date(e.at)}><small>{new Date(e.at).toLocaleTimeString("es-GT")}</small></td>
                <td>
                  <span className={`sev ${isIncident(e) ? "bad" : "good"}`} />
                  <b>{eventLabel(e)}</b>
                  <div><code>{e.action}</code></div>
                </td>
                <td>{e.actor ? <>{e.actor.email}<br /><small className="muted">{ROLE_LABEL[e.actor.role] ?? e.actor.role}</small></> : <span className="muted">anónimo</span>}</td>
                <td><small>{e.ip}</small></td>
                <td><small>{e.target}{e.details ? ` ${JSON.stringify(e.details)}` : ""}</small></td>
                <td title={e.integrity ? "Registro íntegro" : "La firma no coincide"}>{e.integrity ? "✓" : "✗"}</td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan="6" className="muted">Sin eventos para este filtro.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const isAdmin = user.role === "admin";
  return (
    <>
      <div className="page-head"><h1>Panel de administración</h1><span className="tag">{user.role === "admin" ? "Administrador" : "Operador"}</span></div>
      {isAdmin && !user.mfaEnabled && <p className="alert warn">Tu cuenta de administrador no tiene MFA. <Link to="/cuenta">Actívalo aquí</Link>.</p>}
      <nav className="tabs">
        <NavLink to="/admin" end>Resumen</NavLink>
        <NavLink to="/admin/productos">{isAdmin ? "Productos e inventario" : "Inventario"}</NavLink>
        <NavLink to="/admin/pedidos">Pedidos</NavLink>
        {isAdmin && <NavLink to="/admin/usuarios">Usuarios</NavLink>}
        {isAdmin && <NavLink to="/admin/auditoria">Auditoría</NavLink>}
      </nav>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="productos" element={<Products />} />
        <Route path="pedidos" element={<Orders />} />
        <Route path="usuarios" element={isAdmin ? <Users /> : <Navigate to="/admin" />} />
        <Route path="auditoria" element={isAdmin ? <Audit /> : <Navigate to="/admin" />} />
      </Routes>
    </>
  );
}
