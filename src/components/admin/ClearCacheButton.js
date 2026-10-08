'use client';
import { useState } from 'react';
import { RefreshCw, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/admin/ui';

/** One-click "empty all caches" — regenerates every page on next request. */
export default function ClearCacheButton({ size = 'md' }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function clear() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/clear-cache', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      toast.success('All caches cleared');
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" size={size} loading={busy} icon={done ? Check : RefreshCw} onClick={clear}>
      {done ? 'Cleared' : 'Clear cache'}
    </Button>
  );
}
