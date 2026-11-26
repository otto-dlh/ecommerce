// Ruta del laboratorio de seguridad: reportar la ejecucion de una prueba a la bitacora.
// Publica a proposito (el laboratorio se ejecuta con y sin sesion); el control de abuso es el
// limite por IP del servicio y la lista blanca de pruebas.

export function registerLabRoutes({ add }, { lab }) {
  add("POST", "/api/lab/runs", {}, (ctx) => lab.reportRun(ctx, ctx.body));
}
