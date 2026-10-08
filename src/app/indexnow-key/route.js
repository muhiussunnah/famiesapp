/**
 * IndexNow key file. Search engines fetch this URL to verify IndexNow
 * submissions (sent with keyLocation: https://famies.app/indexnow-key by
 * /api/admin/indexing-report), so no static <key>.txt file is needed.
 *
 * Returns the INDEXNOW_KEY env var as text/plain, or 404 when it is unset.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  const key = (process.env.INDEXNOW_KEY || '').trim();
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
