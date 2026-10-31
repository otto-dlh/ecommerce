// Direcciones guardadas del cliente: solo el titular puede verlas o borrarlas (ASVS v5.0.0-8.2.2, T04).
import { NotFoundError } from "../../../shared/domain/errors.mjs";
import * as v from "../../../shared/domain/validate.mjs";
import { parseAddress } from "../../sales/index.mjs";

export function createAddressService({ addresses, audit }) {
  const list = (user) => addresses.listByUser(user.id);

  const create = (user, body) => addresses.create(user.id, parseAddress(body));

  async function remove(ctx, rawId) {
    const id = v.id(rawId);
    if (!(await addresses.delete(ctx.user.id, id))) {
      await audit.record(ctx, "authz.denied", { outcome: "denied", target: `address:${id}` });
      throw new NotFoundError("Dirección no encontrada");
    }
  }

  return { list, create, remove };
}
