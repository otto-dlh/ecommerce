import { test } from "node:test";
import assert from "node:assert/strict";
import { parseItems, buildQuote, SHIPPING_FEE, FREE_SHIPPING_FROM } from "../../netlify/lib/domain/pricing.mjs";
import { ValidationError } from "../../netlify/lib/domain/errors.mjs";

const product = (overrides = {}) => ({ id: "cafe", name: "Café", price: 9500, active: true, stock: 5, emoji: "☕", ...overrides });
const catalog = (...products) => new Map(products.map((p) => [p.id, p]));
const coupon = (overrides = {}) => ({ code: "X", label: "X", type: "percent", value: 10, minSubtotal: 0, oncePerUser: false, active: true, maxUses: null, uses: 0, startsAt: null, endsAt: null, ...overrides });

test("T02: los precios enviados por el cliente se descartan", () => {
  const items = parseItems([{ productId: "cafe", qty: 1, price: 1, unitPrice: 1, total: 1 }]);
  assert.deepEqual(items, [{ productId: "cafe", qty: 1 }]);
  const quote = buildQuote({ items, productsById: catalog(product()) });
  assert.equal(quote.subtotal, 9500);
  assert.equal(quote.total, 9500 + SHIPPING_FEE);
});

test("T02: cantidades negativas, decimales o fuera de rango se rechazan", () => {
  for (const qty of [-5, 0, 1.5, 11, "2"]) {
    assert.throws(() => parseItems([{ productId: "cafe", qty }]), ValidationError, `qty=${qty}`);
  }
});

test("las lineas repetidas se suman y respetan el maximo por producto", () => {
  assert.deepEqual(parseItems([{ productId: "cafe", qty: 3 }, { productId: "cafe", qty: 4 }]), [{ productId: "cafe", qty: 7 }]);
  assert.throws(() => parseItems([{ productId: "cafe", qty: 6 }, { productId: "cafe", qty: 5 }]), /Máximo 10/);
});

test("un producto inexistente o inactivo invalida la cotizacion", () => {
  const items = parseItems([{ productId: "cafe", qty: 1 }]);
  assert.throws(() => buildQuote({ items, productsById: catalog() }), /no disponible/);
  assert.throws(() => buildQuote({ items, productsById: catalog(product({ active: false })) }), /no disponible/);
});

test("envio gratis desde el monto minimo", () => {
  const items = parseItems([{ productId: "cafe", qty: 1 }]);
  const quote = buildQuote({ items, productsById: catalog(product({ price: FREE_SHIPPING_FROM })) });
  assert.equal(quote.shipping, 0);
});

test("cupones porcentual, fijo y de envio", () => {
  const items = parseItems([{ productId: "cafe", qty: 2 }]);
  const productsById = catalog(product());
  assert.equal(buildQuote({ items, productsById, coupon: coupon({ type: "percent", value: 10 }) }).discount, 1900);
  assert.equal(buildQuote({ items, productsById, coupon: coupon({ type: "fixed", value: 5000 }) }).discount, 5000);
  assert.equal(buildQuote({ items, productsById, coupon: coupon({ type: "shipping" }) }).shipping, 0);
});

test("cupon: minimo, vigencia, cupo y uso unico", () => {
  const items = parseItems([{ productId: "cafe", qty: 1 }]);
  const productsById = catalog(product());
  const quoteWith = (c, extra = {}) => buildQuote({ items, productsById, coupon: coupon(c), ...extra });
  assert.throws(() => quoteWith({ minSubtotal: 40000 }), /subtotal mínimo/);
  assert.throws(() => quoteWith({ endsAt: "2000-01-01T00:00:00.000Z" }), /venció/);
  assert.throws(() => quoteWith({ startsAt: "2999-01-01T00:00:00.000Z" }), /todavía no está vigente/);
  assert.throws(() => quoteWith({ maxUses: 3, uses: 3 }), /límite de usos/);
  assert.throws(() => quoteWith({ oncePerUser: true }, { alreadyRedeemed: true }), /Ya utilizaste/);
  assert.throws(() => quoteWith({ active: false }), /Cupón inválido/);
});
