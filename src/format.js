export const money = (cents) =>
  `Q${(cents / 100).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const date = (iso) =>
  new Date(iso).toLocaleString("es-GT", { dateStyle: "medium", timeStyle: "short" });

export const STATUS = {
  pendiente_pago: { label: "Pendiente de pago", tone: "warn" },
  pagado: { label: "Pagado", tone: "ok" },
  preparando: { label: "Preparando", tone: "info" },
  enviado: { label: "Enviado", tone: "info" },
  entregado: { label: "Entregado", tone: "ok" },
  cancelado: { label: "Cancelado", tone: "muted" },
};

export const ROLE_LABEL = { cliente: "Cliente", operador: "Operador", admin: "Administrador" };
