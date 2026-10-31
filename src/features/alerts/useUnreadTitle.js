import { useEffect } from "react";

/** Mantiene el numero de alertas sin leer en el titulo de la pestana (util con el panel en segundo plano). */
export function useUnreadTitle(unread) {
  useEffect(() => {
    const strip = (title) => title.replace(/^\(\d+\+?\) /, "");
    document.title = unread ? `(${unread > 9 ? "9+" : unread}) ${strip(document.title)}` : strip(document.title);
    return () => { document.title = strip(document.title); };
  }, [unread]);
}
