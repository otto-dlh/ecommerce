// Capa de acceso a la API: lo unico que el resto del frontend importa para hablar con el servidor.
// Los componentes llaman funciones de negocio (ordersApi.cancel(id)); nunca escriben URLs ni metodos HTTP.
export { authApi, mfaApi, usersApi, accessApi } from "./identity.js";
export { catalogApi, catalogAdminApi } from "./catalog.js";
export { cartApi, ordersApi, salesAdminApi } from "./sales.js";
export { addressesApi, customersApi } from "./customers.js";
export { auditApi, reportingApi } from "./panel.js";
export { paymentGatewayApi } from "./paymentGateway.js";
export { setCsrf } from "./httpClient.js";
// Solo para el laboratorio de seguridad: peticiones crudas (malformadas a proposito) sobre rutas del catalogo
export { ENDPOINTS } from "./endpoints.js";
export { requestEndpoint } from "./callEndpoint.js";
export { request } from "./httpClient.js";
