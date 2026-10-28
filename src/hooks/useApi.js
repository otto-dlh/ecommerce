import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";

/** Carga un recurso de la API y expone datos, error y una funcion para recargarlo. */
export function useApi(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(
    () => api(path).then((d) => { setData(d); setError(""); }).catch((e) => setError(e.message)),
    [path],
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
