import { useEffect, useState } from "react";
import { CONTROLS, STRIDE } from "./controls.js";

export default function ControlsMatrix() {
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(() => new Set());

  // Los enlaces #control-Txx (desde el diagrama) abren y resaltan la tarjeta
  useEffect(() => {
    const sync = () => {
      const m = /^#control-(T\d{2})$/.exec(window.location.hash);
      if (m) {
        setFilter("");
        setQ("");
        setOpen((o) => new Set(o).add(m[1]));
      }
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const toggle = (id) =>
    setOpen((o) => {
      const n = new Set(o);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const term = q.trim().toLowerCase();
  const items = CONTROLS.filter(
    (c) => (!filter || c.stride.includes(filter)) && (!term || `${c.id} ${c.title} ${c.risk} ${c.defense} ${c.layer}`.toLowerCase().includes(term))
  );

  return (
    <>
      <div className="matrix-toolbar">
        <div className="chips">
          <button className={`chip ${filter === "" ? "active" : ""}`} onClick={() => setFilter("")}>Todas</button>
          {Object.entries(STRIDE).map(([k, label]) => (
            <button key={k} className={`chip ${filter === k ? "active" : ""}`} onClick={() => setFilter(filter === k ? "" : k)} title={label}>
              <b>{k}</b> {label}
            </button>
          ))}
        </div>
        <label className="search">
          <input type="search" placeholder="Buscar control…" value={q} maxLength={40} onChange={(e) => setQ(e.target.value)} aria-label="Buscar control" />
        </label>
      </div>

      <div className="controls">
        {items.map((c) => {
          const isOpen = open.has(c.id);
          return (
            <article key={c.id} id={`control-${c.id}`} className={`control ${isOpen ? "open" : ""}`}>
              <button className="control-toggle" onClick={() => toggle(c.id)} aria-expanded={isOpen}>
                <div className="control-head">
                  <span className="control-id">{c.id}</span>
                  <span className="stride-tags">{c.stride.map((s) => <span key={s} className="stride" title={STRIDE[s]}>{s}</span>)}</span>
                </div>
                <h4>{c.title}</h4>
                <p className="control-risk"><span>Riesgo</span>{c.risk}</p>
                <span className="control-more">{isOpen ? "Ocultar detalle ▲" : "Cómo lo evitamos ▼"}</span>
              </button>
              {isOpen && (
                <div className="control-detail">
                  <p className="control-defense"><span>Defensa</span>{c.defense}</p>
                  <dl>
                    <dt>Dónde verlo</dt><dd>{c.evidence}</dd>
                    <dt>Código</dt><dd><code>{c.code}</code></dd>
                    <dt>Capa</dt><dd>{c.layer}</dd>
                    <dt>ASVS 5.0.0</dt><dd>{c.asvs}</dd>
                  </dl>
                </div>
              )}
            </article>
          );
        })}
        {items.length === 0 && <p className="muted">Ningún control coincide con el filtro.</p>}
      </div>
    </>
  );
}
