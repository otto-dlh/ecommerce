// Proveedor de datos en memoria: implementa todos los puertos sin dependencias externas.
// Sirve para pruebas y para demostrar que cambiar de base de datos no toca dominio ni casos de uso.
// Atomicidad: cada operacion critica corre sin `await` intermedios (JavaScript es de un solo hilo).
import { randomUUID } from "node:crypto";
import { ConflictError, integrityErrors } from "../../domain/errors.mjs";
import { DEFAULT_POLICY } from "../../domain/accessPolicy.mjs";

const copy = (value) => (value === null || value === undefined ? value : structuredClone(value));
const newestFirst = (field) => (a, b) => String(b[field]).localeCompare(String(a[field]));

function createUserRepository() {
  const rows = new Map();
  const byEmail = (email) => [...rows.values()].find((u) => u.email === email) ?? null;
  return {
    async findById(id) { return copy(rows.get(id) ?? null); },
    async findByEmail(email) { return copy(byEmail(email)); },
    async create(user) {
      if (rows.has(user.id) || byEmail(user.email)) throw new ConflictError("El usuario ya existe");
      rows.set(user.id, copy(user));
      return copy(user);
    },
    async update(id, changes) {
      const current = rows.get(id);
      if (!current) return null;
      const next = { ...current, ...copy(changes) };
      rows.set(id, next);
      return copy(next);
    },
    async list({ role, search } = {}) {
      const term = search?.toLowerCase();
      return [...rows.values()]
        .filter((u) => (!role || u.role === role) && (!term || `${u.email} ${u.name}`.toLowerCase().includes(term)))
        .map(copy);
    },
    async countActiveByRole(role) { return [...rows.values()].filter((u) => u.role === role && u.active).length; },
    async advanceMfaCounter(id, counter) {
      const user = rows.get(id);
      if (!user || counter <= (user.mfa?.lastCounter ?? -1)) return false;
      user.mfa = { ...user.mfa, lastCounter: counter };
      return true;
    },
  };
}

function createSessionRepository() {
  const rows = new Map();
  return {
    async create(session) { rows.set(session.keyHash, copy(session)); return copy(session); },
    async findByKeyHash(keyHash) { return copy(rows.get(keyHash) ?? null); },
    async touch(keyHash, lastSeen) { const s = rows.get(keyHash); if (s) s.lastSeen = lastSeen; },
    async delete(keyHash) { return rows.delete(keyHash); },
    async deleteByUser(userId, { exceptKeyHash } = {}) {
      let count = 0;
      for (const [key, s] of rows) if (s.userId === userId && key !== exceptKeyHash) { rows.delete(key); count++; }
      return count;
    },
    async list({ userId } = {}) { return [...rows.values()].filter((s) => !userId || s.userId === userId).sort(newestFirst("lastSeen")).map(copy); },
    async listChannels({ userIds = [], roles = [], excludeUserIds = [] }) {
      return [...rows.values()]
        .filter((s) => (userIds.includes(s.userId) || roles.includes(s.role)) && !excludeUserIds.includes(s.userId))
        .map((s) => s.rtChannel);
    },
    async deleteExpired({ idleBefore, createdBefore }) {
      let count = 0;
      for (const [key, s] of rows) if (s.lastSeen < idleBefore || s.createdAt < createdBefore) { rows.delete(key); count++; }
      return count;
    },
  };
}

function createMfaChallengeRepository() {
  const rows = new Map();
  return {
    async create({ tokenHash, userId, expiresAt }) { rows.set(tokenHash, { userId, expiresAt, attempts: 0 }); },
    async consumeAttempt(tokenHash) {
      const challenge = rows.get(tokenHash);
      if (!challenge) return null;
      const previous = { ...challenge };
      challenge.attempts++;
      return previous;
    },
    async delete(tokenHash) { rows.delete(tokenHash); },
  };
}

function createRateLimitStore() {
  const rows = new Map();
  const id = (bucket, key) => `${bucket}/${key}`;
  const live = (bucket, key, now = Date.now()) => {
    const w = rows.get(id(bucket, key));
    return w && w.resetAt > now ? w : null;
  };
  const view = (key, w) => ({ key, count: w.count, resetAt: new Date(w.resetAt).toISOString(), label: w.label ?? null });
  const start = (bucket, key, windowSec, label) => {
    const w = { bucket, key, count: 1, resetAt: Date.now() + windowSec * 1000, label: label ?? null };
    rows.set(id(bucket, key), w);
    return w;
  };
  return {
    async hit(bucket, key, { limit, windowSec, label }) {
      const w = live(bucket, key);
      if (!w) return { allowed: true, count: start(bucket, key, windowSec, label).count, retryAfterSec: 0 };
      if (w.count >= limit) return { allowed: false, count: w.count, retryAfterSec: Math.max(1, Math.ceil((w.resetAt - Date.now()) / 1000)) };
      w.count++;
      return { allowed: true, count: w.count, retryAfterSec: 0 };
    },
    async peek(bucket, key) { const w = live(bucket, key); return w ? view(key, w) : null; },
    async increment(bucket, key, { windowSec, label }) {
      const w = live(bucket, key);
      if (!w) return start(bucket, key, windowSec, label).count;
      w.count++;
      if (label) w.label = label;
      return w.count;
    },
    async clear(bucket, key) { rows.delete(id(bucket, key)); },
    async list(bucket, { minCount = 1 } = {}) {
      const now = Date.now();
      return [...rows.values()].filter((w) => w.bucket === bucket && w.resetAt > now && w.count >= minCount).map((w) => view(w.key, w));
    },
  };
}

function createPolicyRepository() {
  let stored = {};
  return {
    async get() { return { ...DEFAULT_POLICY, ...stored }; },
    async update(changes) { stored = { ...stored, ...changes }; return { ...DEFAULT_POLICY, ...stored }; },
  };
}

/** Repositorio generico por clave para entidades simples. */
function createKeyedRepository(keyOf, duplicateMessage) {
  const rows = new Map();
  return {
    rows,
    async list() { return [...rows.values()].map(copy); },
    async find(key) { return copy(rows.get(key) ?? null); },
    async create(item) {
      if (rows.has(keyOf(item))) throw new ConflictError(duplicateMessage);
      rows.set(keyOf(item), copy(item));
      return copy(item);
    },
    async update(key, changes) {
      const current = rows.get(key);
      if (!current) return null;
      const next = { ...current, ...copy(changes) };
      rows.set(key, next);
      return copy(next);
    },
  };
}

function createCategoryRepository() {
  const base = createKeyedRepository((c) => c.id, "Ya existe una categoría con ese id");
  return { list: base.list, findById: base.find, create: base.create, update: base.update };
}

function createProductRepository(products) {
  return {
    list: products.list,
    findById: products.find,
    async findByIds(ids) { return ids.map((id) => products.rows.get(id)).filter(Boolean).map(copy); },
    create: products.create,
    update: products.update,
    async adjustStock(id, delta) {
      const product = products.rows.get(id);
      if (!product) return null;
      if (product.stock + delta < 0) throw integrityErrors.negativeStock();
      const before = product.stock;
      product.stock += delta;
      product.updatedAt = new Date().toISOString();
      return { before, after: product.stock };
    },
    async countByCategory(categoryId) { return [...products.rows.values()].filter((p) => p.categoryId === categoryId).length; },
  };
}

function createCouponRepository() {
  const base = createKeyedRepository((c) => c.code, "Ya existe un cupón con ese código");
  const redemptions = new Map(); // "codigo|pedido" → usuario
  return {
    list: base.list,
    findByCode: base.find,
    create: base.create,
    update: base.update,
    async hasRedeemed(userId, code) { return [...redemptions].some(([key, user]) => user === userId && key.startsWith(`${code}|`)); },
    async redeem({ code, userId, orderId }) {
      const key = `${code}|${orderId}`;
      if (redemptions.has(key)) return false;
      redemptions.set(key, userId);
      const coupon = base.rows.get(code);
      if (coupon) coupon.uses = (coupon.uses ?? 0) + 1;
      return true;
    },
  };
}

function createReviewRepository() {
  const rows = new Map();
  return {
    async listByProduct(productId, { includeHidden = false } = {}) {
      return [...rows.values()].filter((r) => r.productId === productId && (includeHidden || !r.hidden)).sort(newestFirst("createdAt")).map(copy);
    },
    async list({ hidden, limit = 200 } = {}) {
      return [...rows.values()].filter((r) => hidden === undefined || r.hidden === hidden).sort(newestFirst("createdAt")).slice(0, limit).map(copy);
    },
    async findById(id) { return copy(rows.get(id) ?? null); },
    async create(review) { rows.set(review.id, copy(review)); return copy(review); },
    async setHidden(id, { hidden, moderatedBy }) {
      const review = rows.get(id);
      if (!review) return null;
      Object.assign(review, { hidden, moderatedBy });
      return copy(review);
    },
  };
}

function createOrderRepository(products) {
  const rows = new Map();

  function assertReservable(order) {
    for (const line of order.items) {
      const product = products.rows.get(line.productId);
      if (!product || !product.active) throw integrityErrors.productUnavailable(line.name);
      if (product.price !== line.unitPrice) throw integrityErrors.priceChanged();
      if (product.stock < line.qty) throw integrityErrors.outOfStock(line.name);
    }
  }

  const moveStock = (order, sign) => {
    for (const line of order.items) {
      const product = products.rows.get(line.productId);
      if (product) product.stock += sign * line.qty;
    }
  };

  return {
    async placeOrder(order) {
      if (rows.has(order.id)) throw integrityErrors.orderExists();
      assertReservable(order);
      moveStock(order, -1);
      rows.set(order.id, copy(order));
      return copy(order);
    },
    async findById(id) { return copy(rows.get(id) ?? null); },
    async listByUser(userId) { return [...rows.values()].filter((o) => o.userId === userId).sort(newestFirst("createdAt")).map(copy); },
    async list({ status } = {}) { return [...rows.values()].filter((o) => !status || o.status === status).sort(newestFirst("createdAt")).map(copy); },
    async listOverdue(nowIso) {
      return [...rows.values()].filter((o) => o.status === "pendiente_pago" && o.expiresAt && o.expiresAt <= nowIso).map(copy);
    },
    async updateStatus(id, { from, to, by, patch = {}, releaseStock = false }) {
      const order = rows.get(id);
      if (!order) throw integrityErrors.orderNotFound();
      if (!from.includes(order.status)) throw integrityErrors.transitionNotAllowed(order.status, to);
      const previous = order.status;
      Object.assign(order, copy(patch), { status: to });
      order.history.push({ status: to, at: new Date().toISOString(), by });
      if (releaseStock) moveStock(order, +1);
      return { order: copy(order), from: previous };
    },
  };
}

function createAddressRepository() {
  const rows = new Map();
  const of = (userId) => rows.get(userId) ?? rows.set(userId, new Map()).get(userId);
  return {
    async listByUser(userId) { return [...of(userId).values()].map(copy); },
    async create(userId, address) {
      const saved = { id: randomUUID(), ...address };
      of(userId).set(saved.id, saved);
      return copy(saved);
    },
    async delete(userId, id) { return of(userId).delete(id); },
  };
}

function createPaymentEventRepository() {
  const seen = new Set();
  return {
    async registerOnce(eventId) {
      if (seen.has(eventId)) return false;
      seen.add(eventId);
      return true;
    },
  };
}

function createAuditRepository() {
  const entries = [];
  return {
    async append(entry) { entries.push(copy(entry)); },
    async list({ limit = 150, since } = {}) {
      return entries.filter((e) => !since || e.at >= since).sort(newestFirst("at")).slice(0, limit).map(copy);
    },
    /** Solo para pruebas: simula una alteracion directa en la base de datos. */
    tamper(id, changes) { Object.assign(entries.find((e) => e.id === id), changes); },
  };
}

function createFileStorage() {
  const files = new Map();
  return {
    async put(key, bytes, contentType) {
      files.set(key, { bytes, contentType });
      return { key, url: `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}` };
    },
    async remove(key) { files.delete(key); },
  };
}

function createRealtimePublisher() {
  const published = [];
  return {
    published,
    async publish(channels, event, payload) { published.push({ channels: [...channels], event, payload: copy(payload) }); },
  };
}

/** @returns {import("../../ports/index.mjs").Adapters} */
export function createMemoryAdapters() {
  const productStore = createKeyedRepository((p) => p.id, "Ya existe un producto con ese id");
  return {
    users: createUserRepository(),
    sessions: createSessionRepository(),
    mfaChallenges: createMfaChallengeRepository(),
    rateLimits: createRateLimitStore(),
    policy: createPolicyRepository(),
    categories: createCategoryRepository(),
    products: createProductRepository(productStore),
    coupons: createCouponRepository(),
    reviews: createReviewRepository(),
    orders: createOrderRepository(productStore),
    addresses: createAddressRepository(),
    paymentEvents: createPaymentEventRepository(),
    audit: createAuditRepository(),
    files: createFileStorage(),
    realtime: createRealtimePublisher(),
  };
}
