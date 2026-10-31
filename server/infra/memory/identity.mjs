// Repositorios en memoria del modulo de identidad.
import { ConflictError } from "../../shared/domain/errors.mjs";
import { DEFAULT_POLICY } from "../../modules/identity/index.mjs";
import { copy, newestFirst } from "./store.mjs";

export function createUserRepository() {
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

export function createSessionRepository() {
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

export function createMfaChallengeRepository() {
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

export function createPolicyRepository() {
  let stored = {};
  return {
    async get() { return { ...DEFAULT_POLICY, ...stored }; },
    async update(changes) { stored = { ...stored, ...changes }; return { ...DEFAULT_POLICY, ...stored }; },
  };
}
