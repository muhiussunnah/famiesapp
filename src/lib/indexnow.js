import crypto from 'node:crypto';

/**
 * The IndexNow key (Bing, Yandex, Seznam …). INDEXNOW_KEY wins when set;
 * otherwise a stable 32-hex key is derived from SESSION_SECRET, so IndexNow
 * works with no manual setup. The key is public by design: it is served at
 * /indexnow-key and only proves the site owns the submissions.
 */
export function indexNowKey() {
  const explicit = (process.env.INDEXNOW_KEY || '').trim();
  if (explicit) return explicit;
  const secret = process.env.SESSION_SECRET || process.env.DATABASE_URL;
  if (!secret) return '';
  return crypto.createHash('sha256').update('famies-indexnow:' + secret).digest('hex').slice(0, 32);
}
