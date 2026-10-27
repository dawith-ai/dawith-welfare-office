import crypto from 'node:crypto';

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;
const MIN_PASSWORD_LENGTH = 12;

export const roles = ['viewer', 'editor', 'admin'];

export function validateUsername(value) {
  const username = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username)) throw new Error('username_invalid');
  return username;
}

export function validatePassword(value) {
  const password = String(value || '');
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 256) throw new Error('password_policy');
  return password;
}

export function hashPassword(password) {
  const normalized = validatePassword(password);
  const salt = crypto.randomBytes(16);
  const digest = crypto.scryptSync(normalized, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64url')}$${digest.toString('base64url')}`;
}

export function verifyPassword(password, encoded) {
  try {
    const [, n, r, p, saltText, digestText] = String(encoded).split('$');
    const salt = Buffer.from(saltText, 'base64url');
    const expected = Buffer.from(digestText, 'base64url');
    const actual = crypto.scryptSync(String(password || ''), salt, expected.length, { N: Number(n), r: Number(r), p: Number(p) });
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function createSession() {
  return crypto.randomBytes(32).toString('base64url');
}

export function publicUser(user) {
  return user ? { username: user.username, role: user.role, createdAt: user.createdAt } : null;
}

export function can(role, required) {
  const rank = { viewer: 1, editor: 2, admin: 3 };
  return Boolean(role && required && rank[role] >= rank[required]);
}

export const authPolicy = {
  minPasswordLength: MIN_PASSWORD_LENGTH,
  sessionHours: 8,
};
