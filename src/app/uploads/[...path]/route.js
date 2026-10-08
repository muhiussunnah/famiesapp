import { promises as fs } from 'node:fs';
import path from 'node:path';
import { resolveUploadPath } from '@/lib/db/storage';

/**
 * Serves uploaded images (admin uploads + Writerfy) from UPLOAD_DIR.
 * File names are unique per upload, so responses are cached for a year.
 */

export const runtime = 'nodejs';

const TYPES = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

export async function GET(_req, { params }) {
  const { path: parts } = await params;
  const target = resolveUploadPath((parts || []).map(decodeURIComponent).join('/'));
  const type = target && TYPES[path.extname(target.full).toLowerCase()];
  if (!target || !type) return new Response('Not found', { status: 404 });

  try {
    const file = await fs.readFile(target.full);
    return new Response(file, {
      headers: {
        'Content-Type': type,
        'Content-Length': String(file.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        // SVGs can carry scripts — never let them run in our origin.
        ...(type === 'image/svg+xml' ? { 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" } : {}),
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
