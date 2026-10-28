// Suite de contrato de los puertos: cualquier proveedor de datos debe pasarla (principio de sustitucion).
// Usa identificadores unicos y crea sus propios datos, asi puede correr contra una base persistente.
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { ConflictError, NotFoundError } from "../../netlify/lib/domain/errors.mjs";
import { DEFAULT_POLICY } from "../../netlify/lib/domain/accessPolicy.mjs";

const run = randomUUID().slice(0, 8);
let seq = 0;
const uid = (prefix) => `ct-${prefix}-${run}-${++seq}`;
const iso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();
const hashOf = (value) => createHash("sha256").update(value).digest("hex");

const userFixture = (overrides = {}) => ({
  id: randomUUID(), email: `${uid("u")}@contrato.test`, name: "Contrato Prueba", role: "cliente", active: true,
  passwordHash: "scrypt$1$1$1$c2Fs$aGFzaA==", mfa: { enabled: false }, mustChangePassword: false, createdAt: iso(), lastLoginAt: null, ...overrides,
});

/**
 * @param {string} providerName
 * @param {() => Promise<import("../../netlify/lib/ports/index.mjs").Adapters>} makeAdapters
 * @param {{ cleanup?: () => Promise<void> }} [options]  borra los datos de prueba en proveedores persistentes
 */
export function describeRepositoryContract(providerName, makeAdapters, { cleanup } = {}) {
  describe(`Contrato de puertos · ${providerName}`, () => {
    /** @type {import("../../netlify/lib/ports/index.mjs").Adapters} */
    let r;
    let category;
    before(async () => {
      r = await makeAdapters();
      category = await r.categories.create({ id: uid("cat"), name: "Categoría contrato", description: "", active: true, sortOrder: 99 });
    });
    if (cleanup) after(cleanup);

    const newUser = (overrides) => r.users.create(userFixture(overrides));
    const newProduct = (overrides = {}) => r.products.create({
      id: uid("p"), name: "Producto contrato", description: "Para pruebas", price: 1000, categoryId: category.id, emoji: "🧪",
      color: "#123456", image: null, imageKey: null, stock: 5, active: true, createdAt: iso(), updatedAt: iso(), ...overrides,
    });
    const orderFor = (user, lines, overrides = {}) => ({
      id: randomUUID(), userId: user.id, items: lines,
      subtotal: lines.reduce((s, l) => s + l.lineTotal, 0), discount: 0, shipping: 0, total: lines.reduce((s, l) => s + l.lineTotal, 0),
      coupon: null, address: { name: "C", line1: "Calle 1", city: "Guate", phone: "55555555" }, status: "pendiente_pago",
      history: [{ status: "pendiente_pago", at: iso(), by: user.id }], payment: null, createdAt: iso(), expiresAt: iso(15 * 60_000), ...overrides,
    });
    const line = (product, qty, unitPrice = product.price) => ({ productId: product.id, name: product.name, unitPrice, qty, lineTotal: unitPrice * qty });

    describe("users", () => {
      it("crea, busca por correo e id, y rechaza correos duplicados", async () => {
        const user = await newUser();
        assert.deepEqual(await r.users.findByEmail(user.email), user);
        assert.deepEqual(await r.users.findById(user.id), user);
        await assert.rejects(r.users.create(userFixture({ email: user.email })), ConflictError);
        assert.equal(await r.users.findById(randomUUID()), null);
        // Un id con formato invalido es simplemente "no existe" (no un error del proveedor)
        assert.equal(await r.users.findById("no-existe"), null);
        assert.equal(await r.users.update("no-existe", { active: false }), null);
      });
      it("actualiza parcialmente y cuenta activos por rol", async () => {
        const user = await newUser({ role: "auditor" });
        const before = await r.users.countActiveByRole("auditor");
        const updated = await r.users.update(user.id, { active: false, lastLoginAt: iso() });
        assert.equal(updated.active, false);
        assert.equal(updated.email, user.email);
        assert.equal(await r.users.countActiveByRole("auditor"), before - 1);
        assert.equal(await r.users.update(randomUUID(), { active: true }), null);
      });
      it("el contador TOTP solo avanza (anti-replay)", async () => {
        const user = await newUser({ mfa: { enabled: true, secret: "cifrado", lastCounter: 10 } });
        assert.equal(await r.users.advanceMfaCounter(user.id, 10), false);
        assert.equal(await r.users.advanceMfaCounter(user.id, 11), true);
        assert.equal(await r.users.advanceMfaCounter(user.id, 11), false);
        assert.equal((await r.users.findById(user.id)).mfa.lastCounter, 11);
      });
      it("lista con filtro por rol y busqueda", async () => {
        const user = await newUser({ name: `Buscable ${run}` });
        const found = await r.users.list({ search: `buscable ${run}` });
        assert.deepEqual(found.map((u) => u.id), [user.id]);
      });
    });

    describe("sessions", () => {
      const sessionFor = (user, overrides = {}) => ({
        keyHash: hashOf(uid("k")), userId: user.id, role: user.role, csrf: "csrf", rtChannel: uid("rt"), createdAt: iso(), lastSeen: iso(), ipMasked: "10.0.0.0", userAgent: "Chrome · Windows", ...overrides,
      });
      it("crea, busca, toca y borra", async () => {
        const user = await newUser();
        const session = await r.sessions.create(sessionFor(user));
        assert.deepEqual(await r.sessions.findByKeyHash(session.keyHash), session);
        const later = iso(5000);
        await r.sessions.touch(session.keyHash, later);
        assert.equal((await r.sessions.findByKeyHash(session.keyHash)).lastSeen, later);
        assert.equal(await r.sessions.delete(session.keyHash), true);
        assert.equal(await r.sessions.findByKeyHash(session.keyHash), null);
      });
      it("canales por usuario o por rol, y borrado por usuario con excepcion", async () => {
        const admin = await newUser({ role: "admin" });
        const client = await newUser();
        const [a1, a2, c1] = [await r.sessions.create(sessionFor(admin)), await r.sessions.create(sessionFor(admin)), await r.sessions.create(sessionFor(client))];
        assert.deepEqual((await r.sessions.listChannels({ userIds: [client.id] })).sort(), [c1.rtChannel]);
        const adminChannels = await r.sessions.listChannels({ roles: ["admin"] });
        assert.ok([a1.rtChannel, a2.rtChannel].every((ch) => adminChannels.includes(ch)));
        assert.equal(adminChannels.includes(c1.rtChannel), false);
        const withoutAdmin = await r.sessions.listChannels({ userIds: [client.id, admin.id], excludeUserIds: [admin.id] });
        assert.deepEqual(withoutAdmin, [c1.rtChannel], "excluye las sesiones de quien hizo la accion");
        assert.equal(await r.sessions.deleteByUser(admin.id, { exceptKeyHash: a1.keyHash }), 1);
        assert.deepEqual((await r.sessions.list({ userId: admin.id })).map((s) => s.keyHash), [a1.keyHash]);
      });
      it("borra las vencidas por inactividad o antiguedad", async () => {
        const user = await newUser();
        const idle = await r.sessions.create(sessionFor(user, { lastSeen: iso(-3_600_000) }));
        const old = await r.sessions.create(sessionFor(user, { createdAt: iso(-86_400_000) }));
        const fresh = await r.sessions.create(sessionFor(user));
        await r.sessions.deleteExpired({ idleBefore: iso(-1_800_000), createdBefore: iso(-28_800_000) });
        assert.equal(await r.sessions.findByKeyHash(idle.keyHash), null);
        assert.equal(await r.sessions.findByKeyHash(old.keyHash), null);
        assert.ok(await r.sessions.findByKeyHash(fresh.keyHash));
      });
    });

    describe("mfaChallenges", () => {
      it("cada consumo devuelve el estado previo y suma un intento", async () => {
        const user = await newUser();
        const tokenHash = uid("mfa");
        await r.mfaChallenges.create({ tokenHash, userId: user.id, expiresAt: iso(60_000) });
        assert.equal((await r.mfaChallenges.consumeAttempt(tokenHash)).attempts, 0);
        assert.equal((await r.mfaChallenges.consumeAttempt(tokenHash)).attempts, 1);
        await r.mfaChallenges.delete(tokenHash);
        assert.equal(await r.mfaChallenges.consumeAttempt(tokenHash), null);
      });
    });

    describe("rateLimits", () => {
      it("permite hasta el limite y luego indica cuanto esperar", async () => {
        const key = uid("rl");
        const results = [];
        for (let i = 0; i < 4; i++) results.push(await r.rateLimits.hit("contrato", key, { limit: 3, windowSec: 60 }));
        assert.deepEqual(results.map((x) => x.allowed), [true, true, true, false]);
        assert.ok(results[3].retryAfterSec > 0 && results[3].retryAfterSec <= 60);
      });
      it("hit concurrente no supera el limite", async () => {
        const key = uid("rl");
        const results = await Promise.all(Array.from({ length: 8 }, () => r.rateLimits.hit("contrato", key, { limit: 5, windowSec: 60 })));
        assert.equal(results.filter((x) => x.allowed).length, 5);
      });
      it("incrementa fallos con etiqueta, consulta, lista y limpia", async () => {
        const key = uid("rl");
        await r.rateLimits.increment("contrato-fallos", key, { windowSec: 60, label: "c***@x.test" });
        assert.equal(await r.rateLimits.increment("contrato-fallos", key, { windowSec: 60 }), 2);
        const window = await r.rateLimits.peek("contrato-fallos", key);
        assert.equal(window.count, 2);
        assert.equal(window.label, "c***@x.test");
        assert.ok((await r.rateLimits.list("contrato-fallos", { minCount: 2 })).some((w) => w.key === key));
        await r.rateLimits.clear("contrato-fallos", key);
        assert.equal(await r.rateLimits.peek("contrato-fallos", key), null);
      });
    });

    describe("policy", () => {
      it("devuelve todos los campos y aplica cambios parciales", async () => {
        const current = await r.policy.get();
        assert.deepEqual(Object.keys(current).sort(), Object.keys(DEFAULT_POLICY).sort());
        const updated = await r.policy.update({ lockoutMinutes: current.lockoutMinutes });
        assert.deepEqual(updated, current);
      });
    });

    describe("categories y products", () => {
      it("categorias: crear, buscar, actualizar y rechazar duplicados", async () => {
        const cat = await r.categories.create({ id: uid("cat"), name: "Otra", description: "Desc", active: true, sortOrder: 3 });
        assert.deepEqual(await r.categories.findById(cat.id), cat);
        await assert.rejects(r.categories.create(cat), ConflictError);
        assert.equal((await r.categories.update(cat.id, { active: false })).active, false);
        assert.ok((await r.categories.list()).some((c) => c.id === cat.id));
      });
      it("productos: crear, buscar varios, actualizar y contar por categoria", async () => {
        const [p1, p2] = [await newProduct(), await newProduct()];
        assert.deepEqual(await r.products.findById(p1.id), p1);
        assert.deepEqual((await r.products.findByIds([p1.id, p2.id, "no-existe"])).map((p) => p.id).sort(), [p1.id, p2.id].sort());
        await assert.rejects(newProduct({ id: p1.id }), ConflictError);
        assert.equal((await r.products.update(p1.id, { price: 2000 })).price, 2000);
        assert.ok((await r.products.countByCategory(category.id)) >= 2);
      });
      it("ajuste de stock atomico que nunca queda negativo", async () => {
        const product = await newProduct({ stock: 2 });
        assert.deepEqual(await r.products.adjustStock(product.id, 3), { before: 2, after: 5 });
        await assert.rejects(r.products.adjustStock(product.id, -6), ConflictError);
        assert.equal((await r.products.findById(product.id)).stock, 5);
        assert.equal(await r.products.adjustStock("no-existe", 1), null);
      });
    });

    describe("coupons", () => {
      it("canje idempotente por usuario que suma usos una sola vez", async () => {
        const user = await newUser();
        const product = await newProduct();
        const order = await r.orders.placeOrder(orderFor(user, [line(product, 1)]));
        const coupon = await r.coupons.create({ code: uid("cup").toUpperCase(), label: "Cupón", type: "percent", value: 5, minSubtotal: 0, oncePerUser: true, active: true, maxUses: null, uses: 0, startsAt: null, endsAt: null });
        assert.deepEqual(await r.coupons.findByCode(coupon.code), coupon);
        await assert.rejects(r.coupons.create(coupon), ConflictError);
        assert.equal(await r.coupons.hasRedeemed(user.id, coupon.code), false);
        assert.equal(await r.coupons.redeem({ code: coupon.code, userId: user.id, orderId: order.id }), true);
        assert.equal(await r.coupons.redeem({ code: coupon.code, userId: user.id, orderId: order.id }), false);
        assert.equal(await r.coupons.hasRedeemed(user.id, coupon.code), true);
        assert.equal((await r.coupons.findByCode(coupon.code)).uses, 1);
      });
    });

    describe("reviews", () => {
      it("ocultas fuera del listado publico y moderacion reversible", async () => {
        const user = await newUser();
        const product = await newProduct();
        const review = await r.reviews.create({ id: randomUUID(), productId: product.id, userId: user.id, userName: "C", rating: 4, text: "<b>texto</b>", hidden: false, moderatedBy: null, createdAt: iso() });
        assert.deepEqual(await r.reviews.findById(review.id), review);
        const moderator = await newUser({ role: "operador" });
        assert.equal((await r.reviews.setHidden(review.id, { hidden: true, moderatedBy: moderator.id })).hidden, true);
        assert.equal((await r.reviews.listByProduct(product.id)).length, 0);
        assert.equal((await r.reviews.listByProduct(product.id, { includeHidden: true })).length, 1);
        assert.ok((await r.reviews.list({ hidden: true })).some((x) => x.id === review.id));
        assert.equal(await r.reviews.setHidden(randomUUID(), { hidden: true, moderatedBy: moderator.id }), null);
        assert.equal(await r.reviews.setHidden("no-existe", { hidden: true, moderatedBy: moderator.id }), null);
        assert.equal(await r.reviews.findById("no-existe"), null);
      });
    });

    describe("orders", () => {
      it("placeOrder descuenta stock y guarda el pedido completo", async () => {
        const user = await newUser();
        const product = await newProduct({ stock: 5 });
        const order = await r.orders.placeOrder(orderFor(user, [line(product, 2)]));
        assert.deepEqual(await r.orders.findById(order.id), order);
        assert.equal((await r.products.findById(product.id)).stock, 3);
        assert.deepEqual((await r.orders.listByUser(user.id)).map((o) => o.id), [order.id]);
      });
      it("placeOrder es todo o nada: sin stock o precio distinto no reserva nada", async () => {
        const user = await newUser();
        const [plenty, scarce] = [await newProduct({ stock: 5 }), await newProduct({ stock: 1 })];
        await assert.rejects(r.orders.placeOrder(orderFor(user, [line(plenty, 2), line(scarce, 2)])), (err) => err instanceof ConflictError && err.message === `Sin existencias suficientes de "${scarce.name}"`);
        await assert.rejects(r.orders.placeOrder(orderFor(user, [line(plenty, 1, plenty.price - 1)])), /El precio de un producto cambió/);
        await r.products.update(scarce.id, { active: false });
        await assert.rejects(r.orders.placeOrder(orderFor(user, [line(scarce, 1)])), ConflictError);
        assert.equal((await r.products.findById(plenty.id)).stock, 5);
        assert.equal((await r.products.findById(scarce.id)).stock, 1);
      });
      it("compras concurrentes de la ultima unidad: exactamente una", async () => {
        const [u1, u2] = [await newUser(), await newUser()];
        const product = await newProduct({ stock: 1 });
        const results = await Promise.allSettled([r.orders.placeOrder(orderFor(u1, [line(product, 1)])), r.orders.placeOrder(orderFor(u2, [line(product, 1)]))]);
        assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
        assert.equal((await r.products.findById(product.id)).stock, 0);
      });
      it("updateStatus compara y cambia; cancelar libera el stock", async () => {
        const user = await newUser();
        const product = await newProduct({ stock: 3 });
        const order = await r.orders.placeOrder(orderFor(user, [line(product, 2)]));
        const paid = await r.orders.updateStatus(order.id, { from: ["pendiente_pago"], to: "pagado", by: "contrato", patch: { payment: { ref: "pay_1", last4: "4242", brand: "visa", eventId: "evt_1" } } });
        assert.equal(paid.from, "pendiente_pago");
        assert.equal(paid.order.payment.last4, "4242");
        assert.deepEqual(paid.order.history.map((h) => h.status), ["pendiente_pago", "pagado"]);
        await assert.rejects(r.orders.updateStatus(order.id, { from: ["pendiente_pago"], to: "cancelado", by: "contrato" }), (err) => err instanceof ConflictError && err.message === "Transición no permitida: pagado → cancelado");
        await r.orders.updateStatus(order.id, { from: ["pagado"], to: "cancelado", by: "contrato", releaseStock: true });
        assert.equal((await r.products.findById(product.id)).stock, 3);
        await assert.rejects(r.orders.updateStatus(randomUUID(), { from: ["pagado"], to: "cancelado", by: "contrato" }), NotFoundError);
      });
      it("lista vencidos y filtra por estado", async () => {
        const user = await newUser();
        const product = await newProduct();
        const overdue = await r.orders.placeOrder(orderFor(user, [line(product, 1)], { expiresAt: iso(-60_000) }));
        assert.ok((await r.orders.listOverdue(iso())).some((o) => o.id === overdue.id));
        assert.ok((await r.orders.list({ status: "pendiente_pago" })).some((o) => o.id === overdue.id));
      });
    });

    describe("addresses y paymentEvents", () => {
      it("direcciones aisladas por usuario", async () => {
        const [owner, other] = [await newUser(), await newUser()];
        const address = await r.addresses.create(owner.id, { name: "Casa", line1: "Calle 1", city: "Guate", phone: "55555555" });
        assert.equal(await r.addresses.delete(other.id, address.id), false);
        assert.equal(await r.addresses.delete(owner.id, "no-existe"), false);
        assert.deepEqual(await r.addresses.listByUser(owner.id), [address]);
        assert.equal(await r.addresses.delete(owner.id, address.id), true);
      });
      it("cada evento de pago se registra una sola vez", async () => {
        const id = `evt_${uid("x").replaceAll("-", "_")}`;
        assert.equal(await r.paymentEvents.registerOnce(id, { type: "payment.succeeded" }), true);
        assert.equal(await r.paymentEvents.registerOnce(id, { type: "payment.succeeded" }), false);
      });
    });

    describe("audit", () => {
      it("conserva cada registro sin cambios (incluido JSON anidado) y lista recientes primero", async () => {
        const entry = { id: randomUUID(), at: iso(), action: "contrato.prueba", outcome: "ok", actor: { id: randomUUID(), role: "admin", email: "a***@x.test" }, ip: "10.0.0.0", target: `ct:${run}`, details: { z: 1, a: { nested: [1, "dos", null] } }, mac: "f".repeat(64) };
        await r.audit.append(entry);
        const recent = await r.audit.list({ limit: 20, since: iso(-60_000) });
        assert.deepEqual(recent.find((e) => e.id === entry.id), entry);
        const times = recent.map((e) => e.at);
        assert.deepEqual(times, [...times].sort().reverse());
      });
    });

    describe("files y realtime", () => {
      it("guarda y borra archivos devolviendo una URL", async () => {
        const stored = await r.files.put(`contrato/${run}.png`, new Uint8Array([137, 80, 78, 71]), "image/png");
        assert.equal(stored.key, `contrato/${run}.png`);
        assert.ok(stored.url);
        await r.files.remove(stored.key);
      });
      it("publica eventos sin error", async () => {
        await r.realtime.publish([`s:${uid("rt")}`], "contrato.ping", { ok: true });
      });
    });
  });
}
