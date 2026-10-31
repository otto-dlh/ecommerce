// Acceso a la API del modulo de clientes: direcciones propias y consulta de clientes en el panel.
import { ENDPOINTS } from "./endpoints.js";
import { callEndpoint } from "./callEndpoint.js";

const E = ENDPOINTS.customers;
const byId = (id) => ({ params: { id } });

export const addressesApi = {
  list: () => callEndpoint(E.addresses),
  create: (address) => callEndpoint(E.createAddress, { body: address }),
  remove: (id) => callEndpoint(E.deleteAddress, byId(id)),
};

export const customersApi = {
  list: () => callEndpoint(E.customers),
  /** Cada consulta de detalle queda registrada en la bitacora. */
  get: (id) => callEndpoint(E.customer, byId(id)),
};
