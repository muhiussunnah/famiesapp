import { createClient } from '@supabase/supabase-js';
import { hasServiceRoleEnv } from './env';

/**
 * Service-role Supabase client — bypasses RLS. Server-only: use it in
 * Route Handlers after the caller has been authorised (admin session,
 * Writerfy token or cron secret). Returns null when the key is missing.
 */
export function createAdminClient() {
  if (!hasServiceRoleEnv()) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
