// Direccion de envio: solo los campos permitidos, con formato validado.
import * as v from "../../../shared/domain/validate.mjs";

export function parseAddress(body = {}) {
  return {
    name: v.str(body.name, "nombre", { min: 2, max: 80 }),
    line1: v.str(body.line1, "dirección", { min: 5, max: 160 }),
    city: v.str(body.city, "ciudad", { min: 2, max: 60 }),
    phone: v.str(body.phone, "teléfono", { min: 8, max: 20, pattern: /^[0-9+\-\s()]+$/ }),
  };
}
