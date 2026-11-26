// API publica del modulo de laboratorio: reporte de las pruebas de seguridad a la bitacora.
export { createLabService } from "./application/labService.mjs";
export { registerLabRoutes } from "./http/routes.mjs";
export { LAB_TESTS, LAB_RESULTS, LAB_ACTION } from "./domain/labTests.mjs";
