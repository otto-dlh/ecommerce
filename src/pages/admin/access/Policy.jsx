import { useEffect, useState } from "react";
import { api } from "../../../api.js";
import { useApi } from "../../../hooks/useApi.js";
import { ErrorAlert, Loading } from "../ui.jsx";

const NUMERIC_FIELDS = ["sessionIdleMinutes", "sessionMaxHours", "maxFailedLogins", "lockoutMinutes"];

/** Politica de acceso editable dentro de los rangos seguros que define el servidor. */
export default function Policy({ canManage }) {
  const { data, error, load } = useApi("/api/admin/access/policy");
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState({ text: "", tone: "" });

  useEffect(() => { if (data) setForm(data.policy); }, [data]);

  const save = async (e) => {
    e.preventDefault();
    setMessage({ text: "", tone: "" });
    try {
      const body = { ...Object.fromEntries(NUMERIC_FIELDS.map((k) => [k, Number(form[k])])), requireStaffMfa: form.requireStaffMfa };
      await api("/api/admin/access/policy", { method: "PUT", body });
      await load();
      setMessage({ text: "Política actualizada. Se aplica en todas las instancias en un máximo de 30 segundos.", tone: "ok" });
    } catch (err) {
      setMessage({ text: err.message, tone: "error" });
    }
  };

  if (!data || !form) return error ? <ErrorAlert error={error} /> : <Loading list={5} label="Cargando política…" />;
  return (
    <form className="panel form grid-form" onSubmit={save}>
      {NUMERIC_FIELDS.map((key) => {
        const limit = data.limits[key];
        return (
          <label key={key}>
            {limit.label}
            <input type="number" min={limit.min} max={limit.max} required disabled={!canManage} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            <small className="muted">Entre {limit.min} y {limit.max}</small>
          </label>
        );
      })}
      <label className="check span2">
        <input type="checkbox" disabled={!canManage} checked={form.requireStaffMfa} onChange={(e) => setForm({ ...form, requireStaffMfa: e.target.checked })} />
        Exigir MFA al personal (administrador, operador y auditor) para usar el panel
      </label>
      {message.text && <p className={`alert ${message.tone} span2`}>{message.text}</p>}
      {canManage && <div className="row span2"><button className="btn">Guardar política</button></div>}
    </form>
  );
}
