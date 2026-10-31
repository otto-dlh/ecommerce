// Rutas HTTP del modulo de identidad: sesion, cuenta propia, accesos y usuarios.
import { registerAuthRoutes } from "./authRoutes.mjs";
import { registerAccessRoutes } from "./accessRoutes.mjs";
import { registerUserRoutes } from "./userRoutes.mjs";

export function registerIdentityRoutes(router, services) {
  registerAuthRoutes(router, services);
  registerAccessRoutes(router, services);
  registerUserRoutes(router, services);
}
