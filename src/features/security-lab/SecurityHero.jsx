import "./security.css";

/** Portada del laboratorio con el marcador de ataques bloqueados. */
export function SecurityHero({ done, passed }) {
  return (
    <section className="sec-hero">
      <span className="eyebrow"><span className="dot" /> Seguridad verificable</span>
      <h1>Atácala tú mismo. <span className="gradient-text">Debería resistir.</span></h1>
      <p>Controles implementados para las 14 amenazas STRIDE del Entregable 1, con trazabilidad a OWASP ASVS 5.0.0. El laboratorio lanza ataques reales contra la API desplegada.</p>
      <div className="score">
        <div><b>{done ? `${passed}/${done}` : "—"}</b><span>ataques bloqueados</span></div>
        <div><b>14</b><span>amenazas cubiertas</span></div>
        <div><b>7</b><span>capas de defensa</span></div>
      </div>
    </section>
  );
}
