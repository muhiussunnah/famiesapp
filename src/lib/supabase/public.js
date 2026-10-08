import { createClient } from '@supabase/supabase-js';
import { hasSupabaseEnv } from './env';

const TIMEOUT_MS = 8000;

/**
 * Anonymous (RLS-limited) Supabase client for public server-side reads.
 *
 * Every request goes through Next's data cache with a short revalidate
 * window and cache tags, so admin edits show up within a minute — and
 * instantly when the admin API calls revalidateTag()/revalidatePath().
 * Requests time out after 8s so a slow or unreachable database can never
 * hang a page render. Returns null when the env vars are missing.
 */
export function createPublicClient({ tags = [], revalidate = 60 } = {}) {
  if (!hasSupabaseEnv()) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (url, init = {}) =>
          fetch(url, {
            ...init,
            signal: init.signal ?? AbortSignal.timeout(TIMEOUT_MS),
            next: { revalidate, tags },
          }),
      },
    }
  );
}
