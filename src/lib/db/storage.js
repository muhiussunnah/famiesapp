import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * File storage on the server's disk, with the same calls the code used
 * for Supabase Storage:
 *
 *   await db.storage.from('images').upload('blog/x.webp', bytes, { contentType, upsert })
 *   db.storage.from('images').getPublicUrl('blog/x.webp')   // → { data: { publicUrl: '/uploads/blog/x.webp' } }
 *
 * Files live in UPLOAD_DIR (a persistent Docker volume in production) and
 * are served by src/app/uploads/[...path]/route.js. The bucket name is
 * accepted for compatibility; everything shares one folder.
 */

export function uploadDir() {
  return path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
}

/** Resolve a stored path safely inside UPLOAD_DIR (no "..", no absolute paths). */
export function resolveUploadPath(relPath) {
  const clean = String(relPath || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter((p) => p && p !== '.' && p !== '..')
    .join('/');
  if (!clean) return null;
  const root = uploadDir();
  const full = path.resolve(root, clean);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return { full, clean };
}

function bucket() {
  return {
    async upload(relPath, data, opts = {}) {
      try {
        const target = resolveUploadPath(relPath);
        if (!target) throw new Error('Invalid file path');
        await fs.mkdir(path.dirname(target.full), { recursive: true });
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(await new Response(data).arrayBuffer());
        await fs.writeFile(target.full, bytes, { flag: opts.upsert ? 'w' : 'wx' });
        return { data: { path: target.clean }, error: null };
      } catch (err) {
        const message = err?.code === 'EEXIST' ? 'The resource already exists' : err?.message || String(err);
        return { data: null, error: { message } };
      }
    },
    getPublicUrl(relPath) {
      const target = resolveUploadPath(relPath);
      return { data: { publicUrl: target ? `/uploads/${target.clean}` : '' } };
    },
  };
}

export const storage = { from: () => bucket() };
