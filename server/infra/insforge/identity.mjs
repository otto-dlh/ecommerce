// Repositorios del modulo de identidad sobre PostgreSQL de InsForge: usuarios, sesiones, desafios MFA y politica.
import { DEFAULT_POLICY } from "../../modules/identity/index.mjs";
import { ConflictError } from "../../shared/domain/errors.mjs";
import { toIso, pickColumns, isUuid } from "./db.mjs";

const USER_FIELDS = {
  id: "id", email: "email", name: "name", role: "role", active: "active", passwordHash: "password_hash",
  mustChangePassword: "must_change_password", createdAt: "created_at", lastLoginAt: "last_login_at",
};

const userFromRow = (row) =>
  row && {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    active: row.active,
    passwordHash: row.password_hash,
    mfa: {
      enabled: row.mfa_enabled,
      secret: row.mfa_secret,
      pendingSecret: row.mfa_pending_secret,
      lastCounter: row.mfa_last_counter === null ? null : Number(row.mfa_last_counter),
    },
    mustChangePassword: row.must_change_password,
    createdAt: toIso(row.created_at),
    lastLoginAt: toIso(row.last_login_at),
  };

function userToRow(user) {
  const row = pickColumns(user, USER_FIELDS);
  if (user.mfa !== undefined) {
    row.mfa_enabled = Boolean(user.mfa.enabled);
    row.mfa_secret = user.mfa.secret ?? null;
    row.mfa_pending_secret = user.mfa.pendingSecret ?? null;
    row.mfa_last_counter = user.mfa.lastCounter ?? null;
  }
  return row;
}

export function createUserRepository(db) {
  const users = () => db.from("app_users");
  return {
    async findById(id) {
      if (!isUuid(id)) return null;
      return userFromRow(await db.run(users().select("*").eq("id", id).maybeSingle()));
    },
    async findByEmail(email) { return userFromRow(await db.run(users().select("*").eq("email", email).maybeSingle())); },
    async create(user) {
      try {
        return userFromRow(await db.run(users().insert([userToRow(user)]).select().single()));
      } catch (err) {
        throw err instanceof ConflictError ? new ConflictError("El usuario ya existe") : err;
      }
    },
    async update(id, changes) {
      if (!isUuid(id)) return null;
      return userFromRow(await db.run(users().update(userToRow(changes)).eq("id", id).select().maybeSingle()));
    },
    async list({ role, search } = {}) {
      let query = users().select("*").order("email");
      if (role) query = query.eq("role", role);
      const all = (await db.run(query)).map(userFromRow);
      // La busqueda se hace aqui para no armar filtros PostgREST con texto del usuario
      const term = search?.toLowerCase();
      return term ? all.filter((u) => `${u.email} ${u.name}`.toLowerCase().includes(term)) : all;
    },
    async countActiveByRole(role) { return db.count(users().select("id", { count: "exact", head: true }).eq("role", role).eq("active", true)); },
    async advanceMfaCounter(id, counter) { return Boolean(await db.rpc("advance_mfa_counter", { p_user_id: id, p_counter: counter })); },
  };
}

const SESSION_FIELDS = {
  keyHash: "key_hash", userId: "user_id", role: "role", csrf: "csrf", rtChannel: "rt_channel",
  createdAt: "created_at", lastSeen: "last_seen", ipMasked: "ip_masked", userAgent: "user_agent",
};

const sessionFromRow = (row) =>
  row && {
    keyHash: row.key_hash,
    userId: row.user_id,
    role: row.role,
    csrf: row.csrf,
    rtChannel: row.rt_channel,
    createdAt: toIso(row.created_at),
    lastSeen: toIso(row.last_seen),
    ipMasked: row.ip_masked,
    userAgent: row.user_agent,
  };

export function createSessionRepository(db) {
  const sessions = () => db.from("sessions");
  const deleted = async (query) => (await db.run(query.select("key_hash"))).length;
  return {
    async create(session) { return sessionFromRow(await db.run(sessions().insert([pickColumns(session, SESSION_FIELDS)]).select().single())); },
    async findByKeyHash(keyHash) { return sessionFromRow(await db.run(sessions().select("*").eq("key_hash", keyHash).maybeSingle())); },
    async touch(keyHash, lastSeen) { await db.run(sessions().update({ last_seen: lastSeen }).eq("key_hash", keyHash)); },
    async delete(keyHash) { return (await deleted(sessions().delete().eq("key_hash", keyHash))) > 0; },
    async deleteByUser(userId, { exceptKeyHash } = {}) {
      let query = sessions().delete().eq("user_id", userId);
      if (exceptKeyHash) query = query.neq("key_hash", exceptKeyHash);
      return deleted(query);
    },
    async list({ userId } = {}) {
      let query = sessions().select("*").order("last_seen", { ascending: false });
      if (userId) query = query.eq("user_id", userId);
      return (await db.run(query)).map(sessionFromRow);
    },
    async listChannels({ userIds = [], roles = [], excludeUserIds = [] }) {
      const queries = [];
      if (userIds.length) queries.push(db.run(sessions().select("rt_channel, user_id").in("user_id", userIds)));
      if (roles.length) queries.push(db.run(sessions().select("rt_channel, user_id").in("role", roles)));
      const rows = (await Promise.all(queries)).flat().filter((row) => !excludeUserIds.includes(row.user_id));
      return [...new Set(rows.map((row) => row.rt_channel))];
    },
    async deleteExpired({ idleBefore, createdBefore }) {
      const [idle, old] = await Promise.all([
        deleted(sessions().delete().lt("last_seen", idleBefore)),
        deleted(sessions().delete().lt("created_at", createdBefore)),
      ]);
      return idle + old;
    },
  };
}

export function createMfaChallengeRepository(db) {
  const challenges = () => db.from("mfa_challenges");
  return {
    async create({ tokenHash, userId, expiresAt }) {
      await db.run(challenges().insert([{ token_hash: tokenHash, user_id: userId, expires_at: expiresAt }]));
    },
    async consumeAttempt(tokenHash) {
      const [row] = await db.rpc("mfa_consume_attempt", { p_token_hash: tokenHash });
      return row ? { userId: row.user_id, expiresAt: toIso(row.expires_at), attempts: row.attempts } : null;
    },
    async delete(tokenHash) { await db.run(challenges().delete().eq("token_hash", tokenHash)); },
  };
}

const POLICY_FIELDS = {
  sessionIdleMinutes: "session_idle_minutes", sessionMaxHours: "session_max_hours",
  maxFailedLogins: "max_failed_logins", lockoutMinutes: "lockout_minutes", requireStaffMfa: "require_staff_mfa",
};

const policyFromRow = (row) =>
  row ? Object.fromEntries(Object.entries(POLICY_FIELDS).map(([field, column]) => [field, row[column]])) : { ...DEFAULT_POLICY };

export function createPolicyRepository(db) {
  const policy = () => db.from("access_policy");
  return {
    async get() { return policyFromRow(await db.run(policy().select("*").eq("id", 1).maybeSingle())); },
    async update(changes) {
      const row = { ...pickColumns(changes, POLICY_FIELDS), updated_at: new Date().toISOString() };
      return policyFromRow(await db.run(policy().update(row).eq("id", 1).select().single()));
    },
  };
}
