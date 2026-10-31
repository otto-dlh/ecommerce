import { useEffect, useState } from "react";
import { addressesApi } from "../../shared/api/index.js";
import { ListSkeleton } from "../../shared/ui/Skeleton.jsx";

/** Direcciones guardadas durante el checkout, con opcion de eliminarlas. */
export function AddressesSection() {
  const [list, setList] = useState(null); // null = cargando
  // Si falla la primera carga se muestra el estado vacío; si falla una recarga se conserva la lista
  const load = () => addressesApi.list().then((d) => setList(d.addresses)).catch(() => setList((cur) => cur ?? []));
  useEffect(() => { load(); }, []);
  const remove = async (id) => { await addressesApi.remove(id); load(); };
  return (
    <section className="panel">
      <h2>Direcciones guardadas</h2>
      {list === null ? <ListSkeleton items={2} label="Cargando direcciones…" /> : list.length === 0 ? <p className="muted">Puedes guardar direcciones durante el checkout.</p> : (
        <ul className="plain">
          {list.map((a) => (
            <li key={a.id} className="row between">
              <span>{a.name} — {a.line1}, {a.city} · {a.phone}</span>
              <button className="btn ghost sm" onClick={() => remove(a.id)}>Eliminar</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
