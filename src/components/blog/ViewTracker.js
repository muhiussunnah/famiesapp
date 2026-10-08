'use client';
import { useEffect } from 'react';

/** Counts one view per article per browser session. Renders nothing. */
export default function ViewTracker({ slug }) {
  useEffect(() => {
    if (!slug) return;
    const key = `famies-viewed:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // Storage blocked (private mode) — still count the view.
    }
    fetch('/api/views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
      keepalive: true,
    }).catch(() => {});
  }, [slug]);

  return null;
}
