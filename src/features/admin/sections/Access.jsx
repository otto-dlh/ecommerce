import { useState } from "react";
import { can } from "../../../shared/lib/permissions.js";
import { useAuth } from "../../auth/index.js";
import { accessApi } from "../../../shared/api/index.js";
import { useApi } from "../../../shared/hooks/useApi.js";
import { useLiveRefresh } from "../../../shared/realtime/RealtimeProvider.jsx";
import { ReadOnlyNote } from "../ui.jsx";
import { ACCESS_EVENTS, isAccessRelated } from "../access/liveEvents.js";
import Sessions from "../access/Sessions.jsx";
import Lockouts from "../access/Lockouts.jsx";
import Accounts from "../access/Accounts.jsx";
import Policy from "../access/Policy.jsx";

const VIEWS = [
  { key: "sesiones", label: "Sesiones activas", Component: Sessions },
  { key: "bloqueos", label: "Intentos y bloqueos", Component: Lockouts },
  { key: "cuentas", label: "Cuentas", Component: Accounts },
  { key: "politica", label: "Política", Component: Policy },
];

function AccessSummary() {
  const { data, load } = useApi(accessApi.summary);
  useLiveRefresh(ACCESS_EVENTS, load, { filter: isAccessRelated, debounceMs: 600 });
  if (!data) return null;
  return (
    <div className="stats">
      <div className="stat"><span>Sesiones activas</span><b>{data.activeSessions}</b></div>
      <div className={`stat ${data.lockedAccounts ? "alarm" : ""}`}><span>Cuentas bloqueadas</span><b>{data.lockedAccounts}</b></div>
      <div className={`stat ${data.failedAttempts24h >= 10 ? "alarm" : ""}`}><span>Intentos fallidos (24 h)</span><b>{data.failedAttempts24h}</b></div>
    </div>
  );
}

/** Administracion del inicio de sesion: sesiones, bloqueos, cuentas y politica. */
export default function Access() {
  const { user } = useAuth();
  const [view, setView] = useState(VIEWS[0].key);
  const canManage = can(user, "access:manage");
  const { Component } = VIEWS.find((v) => v.key === view);
  return (
    <>
      <AccessSummary />
      {!canManage && <ReadOnlyNote />}
      <div className="chips" role="tablist" aria-label="Vistas de accesos">
        {VIEWS.map((v) => (
          <button key={v.key} role="tab" aria-selected={view === v.key} className={`chip ${view === v.key ? "active" : ""}`} onClick={() => setView(v.key)}>{v.label}</button>
        ))}
      </div>
      <Component canManage={canManage} />
    </>
  );
}
