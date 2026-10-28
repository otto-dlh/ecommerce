import { useState } from "react";
import { api } from "../../api.js";
import { can } from "../../permissions.js";
import { useAuth } from "../../state.jsx";
import { useApi } from "../../hooks/useApi.js";
import { useLiveRefresh } from "../../realtime/RealtimeProvider.jsx";
import { ErrorAlert, Loading, ReadOnlyNote } from "./ui.jsx";

const EMPTY_CATEGORY = { id: "", name: "", description: "", sortOrder: 10, active: true };

function CategoryForm({ initial, isNew, onSaved, onCancel }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const set = (key, value) => setForm({ ...form, [key]: value });

  const save = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const body = { name: form.name, description: form.description, sortOrder: Number(form.sortOrder), active: form.active };
      if (isNew) await api("/api/admin/categories", { method: "POST", body: { ...body, id: form.id } });
      else await api(`/api/admin/categories/${form.id}`, { method: "PUT", body });
      onSaved();
    } catch (err) { setError(err.message); }
  };

  return (
    <form className="panel form grid-form" onSubmit={save}>
      {isNew && <label>ID (slug)<input value={form.id} onChange={(e) => set("id", e.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={2} maxLength={40} required /></label>}
      <label>Nombre<input value={form.name} onChange={(e) => set("name", e.target.value)} minLength={2} maxLength={40} required /></label>
      <label>Orden<input type="number" min={0} max={999} value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} required /></label>
      <label className="span2">Descripción<input value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={200} /></label>
      <label className="check"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Visible en la tienda</label>
      <ErrorAlert error={error} />
      <div className="row span2"><button className="btn">Guardar</button><button type="button" className="btn ghost" onClick={onCancel}>Cancelar</button></div>
    </form>
  );
}

/** Categorias del catalogo. No se borran: se ocultan, para no dejar productos sin categoria. */
export default function Categories() {
  const { user } = useAuth();
  const { data, error, load } = useApi("/api/admin/categories");
  useLiveRefresh(["admin.categories", "admin.inventory"], load);
  const [editing, setEditing] = useState(null);
  const canEdit = can(user, "categories:write");

  if (!data) return error ? <ErrorAlert error={error} /> : <Loading headers={["Orden","Categoría","Descripción","Productos","Estado"]} label="Cargando categorías…" />;
  return (
    <>
      {!canEdit && <ReadOnlyNote />}
      {canEdit && !editing && <button className="btn" onClick={() => setEditing(EMPTY_CATEGORY)}>+ Nueva categoría</button>}
      {editing && <CategoryForm initial={editing} isNew={editing === EMPTY_CATEGORY} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      <div className="panel scroll">
        <table className="table">
          <thead><tr><th>Orden</th><th>Categoría</th><th>Descripción</th><th>Productos</th><th>Estado</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {data.categories.map((cat) => (
              <tr key={cat.id} className={cat.active ? "" : "inactive"}>
                <td>{cat.sortOrder}</td>
                <td>{cat.name}<br /><small className="muted">{cat.id}</small></td>
                <td><small>{cat.description || "—"}</small></td>
                <td>{cat.products}</td>
                <td>{cat.active ? <span className="status ok">Visible</span> : <span className="status muted">Oculta</span>}</td>
                {canEdit && <td><button className="btn ghost sm" onClick={() => setEditing(cat)}>Editar</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
