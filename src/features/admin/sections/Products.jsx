import { useState } from "react";
import { catalogAdminApi, catalogApi } from "../../../shared/api/index.js";
import { money } from "../../../shared/lib/format.js";
import { can } from "../../../shared/lib/permissions.js";
import { useAuth } from "../../auth/index.js";
import { useApi } from "../../../shared/hooks/useApi.js";
import { useLiveRefresh } from "../../../shared/realtime/RealtimeProvider.jsx";
import { ErrorAlert, Loading, ReadOnlyNote } from "../ui.jsx";
import "./products.css";

const EMPTY_PRODUCT = { id: "", name: "", description: "", price: 10000, categoryId: "", emoji: "📦", color: "#0f766e", active: true };
const IMAGE_TYPES = "image/jpeg,image/png,image/webp";

function Thumbnail({ product }) {
  return product.image ? <img src={product.image} alt="" className="thumb" /> : <span className="thumb emoji" aria-hidden="true">{product.emoji}</span>;
}

/** Foto del producto: el servidor valida el tipo real del archivo y el tamaño (máx. 2 MB). */
function ImageUploader({ product, onChanged }) {
  const [current, setCurrent] = useState(product);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async (request) => {
    setBusy(true);
    setError("");
    try {
      const { product: updated } = await request();
      setCurrent(updated);
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const upload = (file) => file && send(() => catalogAdminApi.uploadImage(product.id, file));
  const remove = () => send(() => catalogAdminApi.removeImage(product.id));

  return (
    <div className="span2 image-uploader">
      <Thumbnail product={current} />
      <label className={`btn ghost sm ${busy ? "disabled" : ""}`}>
        {busy ? "Subiendo…" : "Subir foto"}
        <input type="file" accept={IMAGE_TYPES} hidden disabled={busy} onChange={(e) => upload(e.target.files[0])} />
      </label>
      {current.image && <button type="button" className="btn ghost sm" disabled={busy} onClick={remove}>Quitar foto</button>}
      <small className="muted">JPEG, PNG o WebP · máximo 2 MB</small>
      <ErrorAlert error={error} />
    </div>
  );
}

function ProductForm({ initial, onSaved, onCancel, onImageChanged }) {
  const [p, setP] = useState(initial);
  const [error, setError] = useState("");
  const { data: cats } = useApi(catalogApi.categories);
  const isNew = !initial.createdAt;
  const save = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const body = { name: p.name, description: p.description, price: Number(p.price), categoryId: p.categoryId, emoji: p.emoji, color: p.color, active: p.active };
      if (isNew) await catalogAdminApi.createProduct({ ...body, id: p.id });
      else await catalogAdminApi.updateProduct(p.id, body);
      onSaved();
    } catch (err) { setError(err.message); }
  };
  const field = (k, label, props = {}) => <label>{label}<input value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} {...props} /></label>;
  return (
    <form className="panel form grid-form" onSubmit={save}>
      {!isNew && <ImageUploader product={initial} onChanged={onImageChanged} />}
      {isNew && field("id", "ID (slug)", { pattern: "[a-z0-9]+(-[a-z0-9]+)*", minLength: 2, maxLength: 40, required: true })}
      {field("name", "Nombre", { required: true, maxLength: 80 })}
      <label>Categoría
        <select value={p.categoryId} onChange={(e) => setP({ ...p, categoryId: e.target.value })} required>
          <option value="" disabled>Elige una categoría</option>
          {cats?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      {field("price", "Precio (centavos)", { type: "number", min: 100, required: true })}
      {field("emoji", "Emoji", { maxLength: 8 })}
      {field("color", "Color", { type: "color" })}
      <label className="span2">Descripción<textarea value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} maxLength={400} required /></label>
      <label className="check"><input type="checkbox" checked={p.active} onChange={(e) => setP({ ...p, active: e.target.checked })} /> Activo</label>
      <ErrorAlert error={error} />
      <div className="row span2"><button className="btn">Guardar</button><button type="button" className="btn ghost" onClick={onCancel}>Cancelar</button></div>
    </form>
  );
}

function StockAdjuster({ productId, onDone }) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const apply = async () => {
    const ok = await onDone(() => catalogAdminApi.adjustStock(productId, { delta: Number(delta), reason }));
    if (ok) { setDelta(""); setReason(""); }
  };
  return (
    <div className="row nowrap">
      <input type="number" className="qty" placeholder="±" value={delta} onChange={(e) => setDelta(e.target.value)} aria-label="Cantidad" />
      <input placeholder="Motivo" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Motivo" />
      <button className="btn sm" onClick={apply}>Aplicar</button>
    </div>
  );
}

export default function Products() {
  const { user } = useAuth();
  const { data, error, load } = useApi(catalogAdminApi.products);
  useLiveRefresh("admin.inventory", load);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState("");
  const canEdit = can(user, "catalog:write");
  const canAdjust = can(user, "inventory:write");

  const runAdjust = async (request) => {
    setMsg("");
    try {
      await request();
      setMsg("Inventario actualizado y registrado en auditoría.");
      await load();
      return true;
    } catch (e) {
      setMsg(e.message);
      return false;
    }
  };

  if (error) return <ErrorAlert error={error} />;
  if (!data) return <Loading headers={["","Producto","Categoría","Precio","Stock"]} rows={8} label="Cargando productos…" />;
  return (
    <>
      {!canEdit && !canAdjust && <ReadOnlyNote />}
      {canEdit && !editing && <button className="btn" onClick={() => setEditing(EMPTY_PRODUCT)}>+ Nuevo producto</button>}
      {editing && <ProductForm initial={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} onImageChanged={load} />}
      {msg && <p className="muted">{msg}</p>}
      <div className="panel scroll">
        <table className="table">
          <thead><tr><th></th><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th>{canAdjust && <th>Ajustar inventario (cantidad + motivo)</th>}{canEdit && <th></th>}</tr></thead>
          <tbody>
            {data.products.map((p) => (
              <tr key={p.id} className={p.active ? "" : "inactive"}>
                <td><Thumbnail product={p} /></td>
                <td>{p.name}<br /><small className="muted">{p.id}{!p.active && " · inactivo"}</small></td>
                <td>{p.category}</td>
                <td>{money(p.price)}</td>
                <td><b>{p.stock}</b></td>
                {canAdjust && <td><StockAdjuster productId={p.id} onDone={runAdjust} /></td>}
                {canEdit && <td><button className="btn ghost sm" onClick={() => setEditing(p)}>Editar</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
