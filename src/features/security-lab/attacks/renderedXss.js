// T07 · Carga XSS renderizada
export const renderedXss = {
  id: "T07", name: "Carga XSS renderizada",
  goal: "Que una reseña con HTML ejecute JavaScript en el navegador de cualquier visitante (XSS almacenado).",
  steps: [
    ["atacante", "Prepara la carga `<img src=x onerror=alert('XSS')>`: una imagen que no existe y que ejecuta código cuando falla su carga."],
    ["servidor", "Si se publicara como reseña, el servidor la guardaría tal cual (máximo 500 caracteres): la defensa no está en filtrar lo que se escribe, sino en cómo se muestra."],
    ["lab", "Crea un párrafo y le asigna la carga como texto (`textContent`), que es como React muestra el texto de una reseña. El proyecto no usa `dangerouslySetInnerHTML` en ningún lugar."],
    ["navegador", "`<` y `>` quedan como caracteres, no como etiquetas: no se crea ningún `<img>`, así que el `onerror` no existe y no se ejecuta."],
    ["navegador", "Respaldo: si algún día se colara HTML, la CSP de producción (`script-src 'self'`) bloquearía el `onerror` en línea."],
  ],
  expect: "No se crea ningún `<img>`: la carga se ve como texto. Es una comprobación en el navegador; para probarlo de punta a punta, publica esa misma reseña en un producto.",
  code: "src/features/catalog/ProductReviews.jsx · tooling/vite/csp.mjs",
  run: async () => {
    const payload = "<img src=x onerror=alert('XSS')>";
    const el = document.createElement("p");
    el.textContent = payload;
    return { pass: el.querySelector("img") === null, status: "—", detail: `Se muestra como texto: ${payload}` };
  },
};
