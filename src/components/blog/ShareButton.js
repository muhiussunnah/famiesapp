'use client';
import { Share2 } from 'lucide-react';
import toast from 'react-hot-toast';

/** Native share sheet on mobile, copy-link fallback on desktop. */
export default function ShareButton({ title, url }) {
  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success('Länken är kopierad!');
    } catch {
      // User closed the share sheet — nothing to do.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="press flex items-center gap-2 px-5 py-2.5 rounded-full glass shadow-soft hover:bg-primary hover:text-white transition-all font-bold text-sm text-ink-700 group"
    >
      <Share2 size={18} className="group-hover:scale-110 transition-transform" /> Dela
    </button>
  );
}
