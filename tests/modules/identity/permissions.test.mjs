import { test } from "node:test";
import assert from "node:assert/strict";
import { ROLES, permissionsOf, can } from "../../../server/modules/identity/domain/permissions.mjs";

// Matriz aprobada en el plan. Si cambia, esta prueba obliga a revisarla conscientemente.
const EXPECTED = {
  admin: [
    "stats:read", "catalog:write", "inventory:read", "inventory:write", "categories:read", "categories:write",
    "coupons:read", "coupons:write", "orders:read", "orders:manage", "orders:cancel", "reviews:moderate",
    "customers:read", "users:read", "users:manage", "access:read", "access:manage", "audit:read",
  ],
  operador: ["stats:read", "inventory:read", "inventory:write", "orders:read", "orders:manage", "reviews:moderate"],
  auditor: ["stats:read", "inventory:read", "categories:read", "coupons:read", "orders:read", "customers:read", "users:read", "access:read", "audit:read"],
  cliente: [],
};

test("los cuatro roles existen", () => {
  assert.deepEqual([...ROLES].sort(), Object.keys(EXPECTED).sort());
});

for (const role of ROLES) {
  test(`permisos del rol ${role}`, () => {
    assert.deepEqual(permissionsOf(role).sort(), [...EXPECTED[role]].sort());
  });
}

test("el auditor solo tiene permisos de lectura", () => {
  assert.ok(permissionsOf("auditor").every((perm) => perm.endsWith(":read")));
});

test("una cuenta desactivada no tiene permisos aunque su rol los tenga", () => {
  assert.equal(can({ role: "admin", active: true }, "users:manage"), true);
  assert.equal(can({ role: "admin", active: false }, "users:manage"), false);
  assert.equal(can(null, "stats:read"), false);
  assert.equal(can({ role: "admin", active: true }, "permiso:inventado"), false);
});
