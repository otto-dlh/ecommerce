// Administracion de usuarios y roles. Un cambio de privilegios revoca las sesiones del afectado.
import { NotFoundError } from "../../../shared/domain/errors.mjs";
import * as v from "../../../shared/domain/validate.mjs";
import { adminUserView, parseUserChanges, assertNotSelf, assertKeepsAnAdmin } from "../domain/users.mjs";

export function createUserAdminService({ users, sessions, audit, events }) {
  async function list(filter = {}) {
    const all = await users.list(filter);
    return all.sort((a, b) => a.email.localeCompare(b.email)).map(adminUserView);
  }

  async function update(ctx, rawId, body) {
    const id = v.id(rawId);
    assertNotSelf(ctx.user, id);
    const changes = parseUserChanges(body);
    const target = await users.findById(id);
    if (!target) throw new NotFoundError("Usuario no encontrado");
    assertKeepsAnAdmin({ target, changes, activeAdmins: await users.countActiveByRole("admin") });
    const updated = await users.update(id, changes);
    const revoked = await sessions.revokeUser(id, { reason: "account_changed" });
    await audit.record(ctx, "user.update", { target: `user:${id}`, details: { ...changes, sesionesRevocadas: revoked } });
    await events.emit("user.updated", { userId: id });
    return adminUserView(updated);
  }

  return { list, update };
}
