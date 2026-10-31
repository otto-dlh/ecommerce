import { test } from "node:test";
import assert from "node:assert/strict";
import { maskIp, maskEmail } from "../../server/shared/domain/masking.mjs";

test("enmascarado de IP y correo para bitácoras y paneles", () => {
  assert.equal(maskIp("190.56.12.34"), "190.56.12.0");
  assert.equal(maskIp("::ffff:190.56.12.34"), "190.56.12.0");
  assert.equal(maskIp("::1"), "::1");
  assert.equal(maskIp("2001:db8:abcd:12:3456::7"), "2001:db8:abcd::");
  assert.equal(maskIp("2001:db8::1"), "2001:db8::");
  assert.equal(maskEmail("carla@tienda.test"), "c***@tienda.test");
});
