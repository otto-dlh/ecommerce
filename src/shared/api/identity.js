// Acceso a la API del modulo de identidad: sesion, cuenta propia, MFA, usuarios y accesos.
import { ENDPOINTS } from "./endpoints.js";
import { callEndpoint } from "./callEndpoint.js";

const E = ENDPOINTS.identity;
const byId = (id) => ({ params: { id } });

export const authApi = {
  me: () => callEndpoint(E.me),
  login: (credentials) => callEndpoint(E.login, { body: credentials }),
  verifyMfa: (mfaToken, code) => callEndpoint(E.verifyMfa, { body: { mfaToken, code } }),
  register: (account) => callEndpoint(E.register, { body: account }),
  logout: () => callEndpoint(E.logout),
  logoutAll: () => callEndpoint(E.logoutAll),
  changePassword: (passwords) => callEndpoint(E.changePassword, { body: passwords }),
};

export const mfaApi = {
  setup: () => callEndpoint(E.mfaSetup),
  enable: (code) => callEndpoint(E.mfaEnable, { body: { code } }),
  disable: (code, password) => callEndpoint(E.mfaDisable, { body: { code, password } }),
};

export const usersApi = {
  list: () => callEndpoint(E.users),
  update: (id, changes) => callEndpoint(E.updateUser, { ...byId(id), body: changes }),
};

export const accessApi = {
  summary: () => callEndpoint(E.accessSummary),
  sessions: () => callEndpoint(E.sessions),
  revokeSession: (id) => callEndpoint(E.revokeSession, byId(id)),
  lockouts: () => callEndpoint(E.lockouts),
  failedAttempts: () => callEndpoint(E.failedAttempts),
  unlock: ({ bucket, key, label }) => callEndpoint(E.unlock, { body: { bucket, key, label } }),
  policy: () => callEndpoint(E.policy),
  updatePolicy: (changes) => callEndpoint(E.updatePolicy, { body: changes }),
  forcePassword: (userId) => callEndpoint(E.forcePassword, byId(userId)),
  resetMfa: (userId) => callEndpoint(E.resetMfa, byId(userId)),
  revokeUserSessions: (userId) => callEndpoint(E.revokeUserSessions, byId(userId)),
};
