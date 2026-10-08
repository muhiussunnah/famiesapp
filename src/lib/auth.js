import crypto from 'node:crypto';

/**
 * Admin sign-in without an external auth service.
 *
 * Credentials come from env vars: ADMIN_EMAIL (or ADMIN_EMAILS, comma
 * separated) and ADMIN_PASSWORD. A successful login sets an HttpOnly cookie
 * holding a payload signed with HMAC-SHA256 (SESSION_SECRET). The payload
 * also carries a fingerprint of the current password, so changing
 * ADMIN_PASSWORD signs every existing session out.
 */

export const SESSION_COOKIE = 'famies_admin';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest();

function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  // Fallback keeps sessions working when only ADMIN_PASSWORD is set.
  return process.env.ADMIN_PASSWORD ? sha256('famies-session:' + process.env.ADMIN_PASSWORD).toString('hex') : null;
}

function passwordFingerprint() {
  return sha256('famies-pw:' + (process.env.ADMIN_PASSWORD || '')).toString('hex').slice(0, 16);
}

function hmac(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

function safeEqual(a, b) {
  // Hash first so lengths always match and timing reveals nothing.
  return crypto.timingSafeEqual(sha256(a), sha256(b));
}

export function isAuthConfigured() {
  return !!process.env.ADMIN_PASSWORD && !!sessionSecret();
}

/** True when email is an admin email and password matches ADMIN_PASSWORD. */
export function checkCredentials(email, password, isAdminEmail) {
  if (!isAuthConfigured()) return false;
  const emailOk = isAdminEmail(email);
  const passwordOk = safeEqual(password || '', process.env.ADMIN_PASSWORD.trim());
  return emailOk && passwordOk;
}

export function createSessionToken(email) {
  const secret = sessionSecret();
  if (!secret) throw new Error('Admin login is not configured (ADMIN_PASSWORD / SESSION_SECRET).');
  const payload = Buffer.from(
    JSON.stringify({ e: email.toLowerCase(), exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE, v: passwordFingerprint() })
  ).toString('base64url');
  return `${payload}.${hmac(payload, secret)}`;
}

/** Returns { email } for a valid, unexpired session token, otherwise null. */
export function verifySessionToken(token) {
  const secret = sessionSecret();
  if (!secret || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig || !safeEqual(sig, hmac(payload, secret))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data?.e || typeof data.exp !== 'number' || data.exp < Date.now() / 1000) return null;
    if (data.v !== passwordFingerprint()) return null;
    return { email: data.e };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(req) {
  const https =
    req?.headers?.get?.('x-forwarded-proto') === 'https' || req?.nextUrl?.protocol === 'https:';
  return { httpOnly: true, sameSite: 'lax', secure: https, path: '/', maxAge: SESSION_MAX_AGE };
}

/* ── Simple in-memory rate limiting (per server process) ─────────────── */

const buckets = new Map();

/** Allow `max` hits per `windowMs` for `key`. Returns true when allowed. */
export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return true;
  }
  b.count += 1;
  return b.count <= max;
}

export function clientIp(req) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}
