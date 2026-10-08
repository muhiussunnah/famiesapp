import { NextResponse } from 'next/server';
import { checkWriterfyAuth } from '@/lib/writerfy-auth';
import { hasServiceRoleEnv } from '@/lib/supabase/env';

/**
 * GET /api/writerfy/publish/health — Writerify's "Test connection" button
 * calls <publish URL>/health. 200 only when the token is right AND the
 * server can write to the database, so a green test means publishing works.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  if (!checkWriterfyAuth(req)) {
    return NextResponse.json(
      { ok: false, error: process.env.WRITERFY_API_TOKEN ? 'invalid token' : 'WRITERFY_API_TOKEN is not set on the server' },
      { status: 401 }
    );
  }
  if (!hasServiceRoleEnv()) {
    return NextResponse.json(
      { ok: false, error: 'Database not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY' },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true, service: 'writerfy-publish', version: 1 });
}
