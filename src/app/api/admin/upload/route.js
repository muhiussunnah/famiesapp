import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { slugify } from '@/lib/content-helpers';

/**
 * Admin image upload → Supabase Storage bucket "images" (public).
 *
 * POST multipart/form-data with a `file` field.
 * Returns { url, path } where path is "blog/<timestamp>-<safe-name>.<ext>".
 */
export const dynamic = 'force-dynamic';

const BUCKET = 'images';
// Vercel rejects request bodies above ~4.5 MB before they reach this route.
const MAX_BYTES = 4 * 1024 * 1024;

// MIME type → file extension. The extension comes from the type, not the
// file name, so "photo.php.png"-style names can't sneak through.
const ALLOWED_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
};

export async function POST(req) {
  const { db, error } = await requireAdmin();
  if (error) return error;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: 'Invalid file type. Use JPG, PNG, WebP, GIF, AVIF or SVG.' },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large. Maximum 4 MB — compress the image (e.g. WebP) and try again.' }, { status: 400 });
  }

  const baseName = String(file.name || '').replace(/\.[^/.]+$/, '');
  const safeName = slugify(baseName, 50) || 'image';
  const path = `blog/${Date.now()}-${safeName}.${ext}`;

  const buffer = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await db.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type,
    cacheControl: '31536000',
    upsert: false,
  });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, path });
}
