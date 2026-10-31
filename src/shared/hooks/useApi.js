import { useCallback, useEffect, useState } from "react";

/**
 * Carga un recurso de la API y expone datos, error y una funcion para recargarlo.
 * @param {() => Promise<object>} fetcher  funcion de la capa de API (p. ej. usersApi.list o () => customersApi.get(id))
 * @param {unknown[]} [deps]               de que depende la consulta (p. ej. [id]); se vuelve a cargar si cambia
 */
export function useApi(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(
    () => fetcher().then((d) => { setData(d); setError(""); }).catch((e) => setError(e.message)),
    // El llamador declara las dependencias: `fetcher` suele ser una funcion nueva en cada render
    deps,
  );

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, load, setError };
}

/** Ejecuta una accion de la API y recarga el recurso; los errores se muestran en la pantalla. */
export function useAction(load, setError) {
  return useCallback(
    async (fn) => {
      try {
        const result = await fn();
        await load();
        return result;
      } catch (e) {
        setError(e.message);
        return null;
      }
    },
    [load, setError],
  );
}
