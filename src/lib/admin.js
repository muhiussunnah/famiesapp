import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Admin access control. Only these emails can open /admin or call
 * /api/admin/*. Add more without a code change via the ADMIN_EMAILS env
 * var (comma separated).
 */
const ADMIN_EMAILS = ['itsinjamul@gmail.com'];

function adminEmails() {
  const extra = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...ADMIN_EMAILS, ...extra]);
}

export function isAdminEmail(email) {
  if (!email) return false;
  return adminEmails().has(email.toLowerCase());
}

/** The signed-in admin user, or null (not signed in / not an admin). */
export async function getAdminUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}

/**
 * Guard for /api/admin/* route handlers.
 *
 *   const { db, user, error } = await requireAdmin();
 *   if (error) return error;
 *
 * `db` is the service-role client (bypasses RLS). `error` is a ready-made
 * 401 / 503 response when the caller is not allowed or the server is not
 * configured.
 */
export async function requireAdmin() {
  const user = await getAdminUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const db = createAdminClient();
  if (!db) {
    return {
      error: NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY is not set on the server.' },
        { status: 503 }
      ),
    };
  }
  return { db, user };
}
