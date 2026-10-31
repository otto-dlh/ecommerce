// API REST de la tienda. Solo compone piezas: contenedor (datos + casos de uso) y pipeline HTTP.
import { getContainer } from "../../server/bootstrap/container.mjs";
import { createApiHandler } from "../../server/http/pipeline.mjs";
import { registerRoutes } from "../../server/bootstrap/routes.mjs";

export default createApiHandler(getContainer, registerRoutes);

export const config = { path: "/api/*" };
