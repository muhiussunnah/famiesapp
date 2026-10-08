import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import {
  checkCredentials, createSessionToken, isAuthConfigured, rateLimit, clientIp,
  SESSION_COOKIE, sessionCookieOptions,
} from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST { email, password } → sets the admin session cookie. */
export async function POST(req) {
  if (!isAuthConfigured()) {
    return NextResponse.json({ error: 'Admininloggning är inte konfigurerad (ADMIN_PASSWORD saknas).' }, { status: 503 });
  }

  // 10 attempts per 15 minutes per IP.
  if (!rateLimit(`login:${clientIp(req)}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: 'För många försök. Vänta en stund och försök igen.' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!checkCredentials(email, password, isAdminEmail)) {
    // Slow down guessing a little.
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: 'Fel e-post eller lösenord.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, createSessionToken(email), sessionCookieOptions(req));
  return res;
}
