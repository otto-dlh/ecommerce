// API publica del modulo de clientes: direcciones guardadas y consulta auditada de clientes.
export { createAddressService } from "./application/addressService.mjs";
export { createCustomerService } from "./application/customerService.mjs";
export { registerCustomerRoutes } from "./http/routes.mjs";
export { CUSTOMER_PORTS } from "./ports.mjs";
