import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { rateLimit, clientIp } from '@/lib/auth';

/**
 * Public form submissions (contact, newsletter, early access). The browser
 * never talks to the database directly; this route validates and stores.
 *
 * POST /api/forms/contact       { name, email, subject, message }
 * POST /api/forms/newsletter    { email }
 * POST /api/forms/early-access  { name, municipality, email, children_age, wants_feedback }
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const text = (max) => (v) => (typeof v === 'string' ? v.trim().slice(0, max) : null);
const bool = (v) => v === true || v === 'true';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FORMS = {
  contact: {
    table: 'contact_messages',
    fields: { name: text(200), email: text(320), subject: text(300), message: text(5000) },
    required: ['email', 'message'],
  },
  newsletter: {
    table: 'newsletter',
    fields: { email: text(320) },
    required: ['email'],
  },
  'early-access': {
    table: 'early_access',
    fields: { name: text(200), municipality: text(200), email: text(320), children_age: text(200), wants_feedback: bool },
    required: ['email'],
  },
};

export async function POST(req, { params }) {
  const { form } = await params;
  const config = FORMS[form];
  if (!config) return NextResponse.json({ error: 'Unknown form' }, { status: 404 });

  if (!rateLimit(`form:${form}:${clientIp(req)}`, 10, 60 * 1000)) {
    return NextResponse.json({ error: 'För många försök, vänta en minut.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const row = {};
  for (const [key, clean] of Object.entries(config.fields)) row[key] = clean(body[key]);
  for (const key of config.required) {
    if (!row[key]) return NextResponse.json({ error: `${key} saknas` }, { status: 400 });
  }
  if (row.email && !EMAIL.test(row.email)) {
    return NextResponse.json({ error: 'Ogiltig e-postadress' }, { status: 400 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ error: 'Databasen är inte konfigurerad' }, { status: 503 });

  const { error } = await db.from(config.table).insert(row);
  if (error) {
    console.error(`[forms] ${form} insert failed:`, error.message);
    return NextResponse.json({ error: 'Kunde inte spara, försök igen.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
