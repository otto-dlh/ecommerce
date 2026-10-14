import { Link } from "react-router-dom";

export function Brand() {
  return (
    <Link to="/" className="brand">
      <span className="brand-mark">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2.5l8 3v6.2c0 4.9-3.4 8.6-8 9.8-4.6-1.2-8-4.9-8-9.8V5.5z" fill="#fff" />
          <path d="M8.5 12l2.4 2.4 4.6-4.9" stroke="#4f46e5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span>
        Tienda Segura
        <small>Hecho en Guatemala</small>
      </span>
    </Link>
  );
}
