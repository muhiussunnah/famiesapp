import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { checkWriterfyAuth } from '@/lib/writerfy-auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/writerfy/upload-image — multipart upload of one image (Writerfy
 * sends ~100–300 KB WebP) plus attribution (alt, license, creator,
 * sourcePage). Returns { url, path } for Writerfy to put in the Markdown.
 *
 * Storage: Vercel Blob when BLOB_READ_WRITE_TOKEN is set, otherwise the
 * Supabase Storage bucket "images" — so it works with either setup.
 * GET → health check.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

function safeFileName(name) {
  return (
    (name || 'upload.webp')
      .replace(/[\\/]/g, '-')
      .replace(/[^\w.-]/g, '-')
      .replace(/-+/g, '-')
      .slice(-120) || 'upload.webp'
  );
}

export async function POST(req) {
  if (!checkWriterfyAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let form;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid multipart body' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file field missing or not a file' }, { status: 400 });
  }
  if (file.size === 0) return NextResponse.json({ error: 'empty file' }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `file too large (${file.size} bytes, max ${MAX_UPLOAD_BYTES})` },
      { status: 413 }
    );
  }
  if (file.type && !file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'only image uploads are accepted' }, { status: 415 });
  }

  const now = new Date();
  const pathname = `writerfy/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${safeFileName(file.name)}`;
  const contentType = file.type || 'image/webp';

  // Provenance log: keeps license/creator on record even if the caption is edited later.
  console.log('[writerfy] image upload', {
    pathname,
    size: file.size,
    alt: String(form.get('alt') ?? ''),
    license: String(form.get('license') ?? ''),
    creator: String(form.get('creator') ?? ''),
    sourcePage: String(form.get('sourcePage') ?? ''),
  });

  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      // Writerfy guarantees unique names per article; a retry overwrites.
      const blob = await put(pathname, file, {
        access: 'public',
        contentType,
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return NextResponse.json({ url: blob.url, path: blob.pathname });
    }

    const db = createAdminClient();
    if (!db) {
      return NextResponse.json(
        { error: 'No image storage configured', hint: 'Set BLOB_READ_WRITE_TOKEN or SUPABASE_SERVICE_ROLE_KEY.' },
        { status: 503 }
      );
    }
    const { error } = await db.storage
      .from('images')
      .upload(pathname, new Uint8Array(await file.arrayBuffer()), {
        contentType,
        cacheControl: '31536000',
        upsert: true,
      });
    if (error) throw error;
    const { data } = db.storage.from('images').getPublicUrl(pathname);
    return NextResponse.json({ url: data.publicUrl, path: pathname });
  } catch (err) {
    return NextResponse.json({ error: 'image upload failed', detail: err?.message || String(err) }, { status: 500 });
  }
}

export async function GET(req) {
  if (!checkWriterfyAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    service: 'writerfy-upload-image',
    version: 1,
    storage: process.env.BLOB_READ_WRITE_TOKEN ? 'vercel-blob' : createAdminClient() ? 'supabase' : 'none',
  });
}
