'use client';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Upload } from 'lucide-react';
import { Button, Field, Input } from '@/components/admin/ui';

/** URL input + upload (POST /api/admin/upload → { url }) + thumbnail. */
export default function ImageField({ label, value, onChange, hint }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) throw new Error(json.error || `Upload failed (${res.status})`);
      onChange(json.url);
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Field label={label} hint={hint}>
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://… or /bild.webp" />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <Button variant="secondary" icon={Upload} loading={uploading} onClick={() => fileRef.current?.click()}>
          Upload
        </Button>
      </div>
      {value && (
        <div className="mt-2 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-16 w-24 rounded-lg border border-ink-100 object-cover bg-ink-50" />
          <button type="button" onClick={() => onChange('')} className="text-[12px] font-semibold text-red-500 hover:text-red-600">
            Remove image
          </button>
        </div>
      )}
    </Field>
  );
}
