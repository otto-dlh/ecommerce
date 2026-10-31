import "./catalog.css";

/** Calificacion de 1 a 5 estrellas. */
export const Stars = ({ n }) => <span className="stars" aria-label={`${n} de 5`}>{"★".repeat(n)}{"☆".repeat(5 - n)}</span>;
