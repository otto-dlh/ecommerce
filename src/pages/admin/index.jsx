import { Suspense } from "react";
import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { can } from "../../permissions.js";
import { useAuth } from "../../state.jsx";
import { ADMIN_SECTIONS } from "./sections.js";
import { Loading } from "./ui.jsx";

/** Panel de administracion: muestra solo las secciones que permite el rol del usuario. */
export default function AdminPanel() {
  const { user } = useAuth();
  const sections = ADMIN_SECTIONS.filter((section) => can(user, section.perm));
  const home = sections[0] ? `/admin/${sections[0].path}` : "/";
  const hasIndex = sections.some((s) => s.path === "");
  return (
    <>
      <div className="page-head"><h1>Panel de administración</h1><span className="tag">{user.roleLabel}</span></div>
      {!user.mfaEnabled && <p className="alert warn">Tu cuenta de personal no tiene MFA. <Link to="/cuenta">Actívalo aquí</Link>.</p>}
      <nav className="tabs">
        {sections.map((s) => <NavLink key={s.path} to={`/admin/${s.path}`} end={s.path === ""}>{s.label}</NavLink>)}
      </nav>
      <Suspense fallback={<Loading />}>
        <Routes>
          {sections.map(({ path, Component }) => (path === "" ? <Route key="index" index element={<Component />} /> : <Route key={path} path={path} element={<Component />} />))}
          {!hasIndex && <Route index element={<Navigate to={home} replace />} />}
          <Route path="*" element={<Navigate to={home} replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
