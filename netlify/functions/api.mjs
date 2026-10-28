// API REST de la tienda. Solo compone piezas: contenedor (datos + casos de uso) y pipeline HTTP.
import { getContainer } from "../lib/infra/container.mjs";
import { createApiHandler } from "../lib/http/pipeline.mjs";
import { registerRoutes } from "../lib/http/routes/index.mjs";

export default createApiHandler(getContainer, registerRoutes);

export const config = { path: "/api/*" };
