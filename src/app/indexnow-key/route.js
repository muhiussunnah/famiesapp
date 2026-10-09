/**
 * IndexNow key file. Search engines fetch this URL to verify IndexNow
 * submissions (sent with keyLocation: https://famies.app/indexnow-key by
 * /api/admin/indexing-report), so no static <key>.txt file is needed.
 *
 * Returns the IndexNow key (INDEXNOW_KEY, or one derived from SESSION_SECRET)
 * as text/plain, or 404 when neither is available.
 */
import { indexNowKey } from '@/lib/indexnow';

export const dynamic = 'force-dynamic';

export function GET() {
  const key = indexNowKey();
  if (!key) {
    return new Response('Not found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  return new Response(key, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Robots-Tag': 'noindex',
    },
  });
}
