import { STATUS } from "../../shared/lib/format.js";

/** Estado de un pedido como etiqueta de color. */
export const StatusBadge = ({ status }) => <span className={`status ${STATUS[status]?.tone}`}>{STATUS[status]?.label ?? status}</span>;
