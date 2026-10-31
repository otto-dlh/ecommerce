import { ENDPOINTS, request } from "../../../shared/api/index.js";

// T08 · Búsqueda con carga de inyección
export const searchInjection = {
  id: "T08", name: "Búsqueda con carga de inyección",
  goal: "Que el servidor ejecute código del atacante contra la base de datos a través del buscador (inyección SQL).",
  steps: [
    ["atacante", "Escribe `' OR 1=1 --` en el buscador, que envía `GET /api/products?q=…`."],
    ["atacante", "Espera que el servidor arme una consulta SQL pegando texto: la comilla cerraría la cadena, `OR 1=1` haría la condición siempre verdadera y `--` anularía el resto, devolviendo todo el catálogo."],
    ["servidor", "Valida el parámetro: tiene menos de 60 caracteres y ningún carácter de control, así que lo acepta como texto."],
    ["servidor", "Nunca arma una consulta: compara el texto literal contra el nombre y la descripción de cada producto activo. Ninguno contiene esa cadena."],
    ["servidor", "Responde una lista vacía; cuando hay resultados, solo incluye campos públicos."],
  ],
  expect: "`200` con 0 resultados: se buscó la cadena tal cual.",
  code: "server/modules/catalog/domain/catalog.mjs · server/shared/domain/validate.mjs",
  run: async () => {
    const r = await request(ENDPOINTS.catalog.products.url({}, { q: "' OR 1=1 --" }));
    return { pass: r.ok && r.data.products.length === 0, status: r.status, detail: `Tratado como texto literal: ${r.data.products?.length ?? "?"} resultados` };
  },
};
