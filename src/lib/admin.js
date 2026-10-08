import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth';

/**
 * Admin access control. Only these emails can sign in to /admin or call
 * /api/admin/*. More can be added without a code change via ADMIN_EMAIL /
 * ADMIN_EMAILS (comma separated). The password is ADMIN_PASSWORD.
 */
const ADMIN_EMAILS = ['itsinjamul@gmail.com'];

function adminEmails() {
  const extra = `${process.env.ADMIN_EMAILS || ''},${process.env.ADMIN_EMAIL || ''}`
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...ADMIN_EMAILS, ...extra]);
}

export function isAdminEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return adminEmails().has(email.trim().toLowerCase());
}

/** The signed-in admin ({ email }) from the session cookie, or null. */
export async function getAdminUser() {
  const store = await cookies();
  const session = verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!session || !isAdminEmail(session.email)) return null;
  return session;
}

/**
 * Guard for /api/admin/* route handlers.
 *
 *   const { db, user, error } = await requireAdmin();
 *   if (error) return error;
 *
 * `error` is a ready-made 401 / 503 response when the caller is not an
 * admin or the database is not configured.
 */
export async function requireAdmin() {
  const user = await getAdminUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const db = getDb();
  if (!db) {
    return {
      error: NextResponse.json({ error: 'DATABASE_URL is not set on the server.' }, { status: 503 }),
    };
  }
  return { db, user };
}
