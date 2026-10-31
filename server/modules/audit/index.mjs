// API publica del modulo de auditoria: bitacora append-only con firma HMAC por registro.
export { createAuditService } from "./application/auditService.mjs";
export { registerAuditRoutes } from "./http/routes.mjs";
export { AUDIT_PORTS } from "./ports.mjs";
