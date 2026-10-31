// API publica del modulo de identidad: login propio, sesiones, MFA, usuarios, roles y politica de acceso.
// Es lo unico que otros modulos, la capa HTTP y la composicion pueden importar de este modulo.
export { createAuthService } from "./application/authService.mjs";
export { createSessionService, privateChannel } from "./application/sessionService.mjs";
export { createPolicyService } from "./application/policyService.mjs";
export { createAccessService } from "./application/accessService.mjs";
export { createUserAdminService } from "./application/userAdminService.mjs";
export { can, rolesWith, ROLES } from "./domain/permissions.mjs";
export { needsMfaForPanel, publicDisplayName } from "./domain/users.mjs";
export { DEFAULT_POLICY } from "./domain/accessPolicy.mjs";
export { registerIdentityRoutes } from "./http/routes.mjs";
export { IDENTITY_PORTS } from "./ports.mjs";
