import { useState } from "react";
import { salesAdminApi } from "../../../shared/api/index.js";
import { date, money } from "../../../shared/lib/format.js";
import { can } from "../../../shared/lib/permissions.js";
import { useAuth } from "../../auth/index.js";
import { useApi } from "../../../shared/hooks/useApi.js";
import { useLiveRefresh } from "../../../shared/realtime/RealtimeProvider.jsx";
import { ErrorAlert, Loading, ReadOnlyNote } from "../ui.jsx";

const TYPE_LABELS = { percent: "Porcentaje", fixed: "Monto fijo", shipping: "Envío gratis" };
const EMPTY_COUPON = { code: "", label: "", type: "percent", value: 10, minSubtotal: 0, oncePerUser: false, active: true, maxUses: "", startsAt: "", endsAt: "" };

const describeValue = (c) => (c.type === "percent" ? `${c.value} %` : c.type === "fixed" ? money(c.value) : "—");
const toInputDate = (iso) => (iso ? iso.slice(0, 16) : "");
const fromInputDate = (value) => (value ? new Date(value).toISOString() : null);

function CouponForm({ initial, onSaved, onCancel }) {
  const isNew = !initial.code;
  const [form, setForm] = useState({ ...initial, maxUses: initial.maxUses ?? "", startsAt: toInputDate(initial.startsAt), endsAt: toInputDate(initial.endsAt) });
  const [error, setError] = useState("");
  const set = (key, value) => setForm({ ...form, [key]: value });

  const save = async (e) => {
    e.preventDefault();
    setError("");
    const body = {
      label: form.label, type: form.type, value: form.type === "shipping" ? 0 : Number(form.value), minSubtotal: Number(form.minSubtotal),
      oncePerUser: form.oncePerUser, active: form.active, maxUses: form.maxUses === "" ? null : Number(form.maxUses),
      startsAt: fromInputDate(form.startsAt), endsAt: fromInputDate(form.endsAt),
    };
    try {
      if (isNew) await salesAdminApi.createCoupon({ ...body, code: form.code });
      else await salesAdminApi.updateCoupon(form.code, body);
      onSaved();
    } catch (err) { setError(err.message); }
  };

  return (
    <form className="panel form grid-form" onSubmit={save}>
      {isNew && <label>Código<input value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} pattern="[A-Za-z0-9_-]{3,30}" required /></label>}
      <label>Descripción<input value={form.label} onChange={(e) => set("label", e.target.value)} minLength={3} maxLength={80} required /></label>
      <label>Tipo
        <select value={form.type} onChange={(e) => set("type", e.target.value)}>
          {Object.entries(TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      {form.type !== "shipping" && <label>{form.type === "percent" ? "Porcentaje (1–100)" : "Descuento (centavos)"}<input type="number" min={form.type === "percent" ? 1 : 100} max={form.type === "percent" ? 100 : undefined} value={form.value} onChange={(e) => set("value", e.target.value)} required /></label>}
      <label>Subtotal mínimo (centavos)<input type="number" min={0} value={form.minSubtotal} onChange={(e) => set("minSubtotal", e.target.value)} required /></label>
      <label>Usos máximos (vacío = sin límite)<input type="number" min={1} value={form.maxUses} onChange={(e) => set("maxUses", e.target.value)} /></label>
      <label>Inicio<input type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></label>
      <label>Fin<input type="datetime-local" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} /></label>
      <label className="check"><input type="checkbox" checked={form.oncePerUser} onChange={(e) => set("oncePerUser", e.target.checked)} /> Un uso por cliente</label>
      <label className="check"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Activo</label>
      <ErrorAlert error={error} />
      <div className="row span2"><button className="btn">Guardar</button><button type="button" className="btn ghost" onClick={onCancel}>Cancelar</button></div>
    </form>
  );
}

const validity = (c) => (c.startsAt || c.endsAt ? `${c.startsAt ? date(c.startsAt) : "…"} → ${c.endsAt ? date(c.endsAt) : "…"}` : "Siempre");

/** Cupones de descuento. Viven solo en el servidor: el cliente envía un código, nunca un descuento. */
export default function Coupons() {
  const { user } = useAuth();
  const { data, error, load } = useApi(salesAdminApi.coupons);
  useLiveRefresh(["admin.coupons", "admin.orders"], load);
  const [editing, setEditing] = useState(null);
  const canEdit = can(user, "coupons:write");

  if (!data) return error ? <ErrorAlert error={error} /> : <Loading headers={["Código","Tipo","Valor","Mínimo","Usos","Vigencia","Estado"]} label="Cargando cupones…" />;
  return (
    <>
      {!canEdit && <ReadOnlyNote />}
      {canEdit && !editing && <button className="btn" onClick={() => setEditing(EMPTY_COUPON)}>+ Nuevo cupón</button>}
      {editing && <CouponForm initial={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      <div className="panel scroll">
        <table className="table">
          <thead><tr><th>Código</th><th>Tipo</th><th>Valor</th><th>Mínimo</th><th>Usos</th><th>Vigencia</th><th>Estado</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {data.coupons.map((c) => (
              <tr key={c.code} className={c.active ? "" : "inactive"}>
                <td><b>{c.code}</b><br /><small className="muted">{c.label}</small></td>
                <td>{TYPE_LABELS[c.type]}{c.oncePerUser && <><br /><small className="muted">uno por cliente</small></>}</td>
                <td>{describeValue(c)}</td>
                <td>{money(c.minSubtotal)}</td>
                <td>{c.uses}{c.maxUses ? ` / ${c.maxUses}` : ""}</td>
                <td><small>{validity(c)}</small></td>
                <td>{c.active ? <span className="status ok">Activo</span> : <span className="status muted">Inactivo</span>}</td>
                {canEdit && <td><button className="btn ghost sm" onClick={() => setEditing(c)}>Editar</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
