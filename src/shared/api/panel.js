// Acceso a la API de los modulos de auditoria y reportes del panel.
import { ENDPOINTS } from "./endpoints.js";
import { callEndpoint } from "./callEndpoint.js";

export const auditApi = {
  entries: ({ limit } = {}) => callEndpoint(ENDPOINTS.audit.entries, { query: { limit } }),
};

export const reportingApi = {
  stats: () => callEndpoint(ENDPOINTS.reporting.stats),
};
