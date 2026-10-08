'use client';
import { useEffect, useState } from 'react';

/**
 * Fixed-position animated blobs that sit behind all content.
 * - 3 blobs drift with CSS keyframes (always animating).
 * - On scroll, they translate opposite to scroll direction → parallax feel.
 * - Hue subtly shifts between pink and mint zones as you scroll.
 * Colors stay within brand: #FF8FAF + #CCFAD6 only.
 */
export default function BackgroundBlobs() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrollY(window.scrollY));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Parallax strengths (different per blob for depth)
  const y1 = scrollY * -0.12;
  const y2 = scrollY * 0.08;
  const y3 = scrollY * -0.18;

  // Hue-mix factor: oscillates between 0 (pink-heavy) and 1 (mint-heavy)
  // so the whole background palette breathes as you scroll.
  const mix = (Math.sin(scrollY / 900) + 1) / 2;

  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
      style={{
        background: `linear-gradient(${180 + mix * 30}deg,
          rgba(255, 143, 175, ${0.08 + mix * 0.04}) 0%,
          rgba(255, 255, 255, 0) 40%,
          rgba(204, 250, 214, ${0.08 + (1 - mix) * 0.05}) 100%)`,
      }}
    >
      {/* Blob 1, pink, top-left */}
      <div
        className="absolute blob-drift-1"
        style={{
          top: '-8%',
          left: '-10%',
          width: '48rem',
          height: '48rem',
          transform: `translate3d(0, ${y1}px, 0)`,
          background:
            'radial-gradient(circle at 30% 30%, rgba(255,143,175,0.55), rgba(255,143,175,0) 60%)',
          filter: 'blur(80px)',
          willChange: 'transform',
        }}
      />

      {/* Blob 2, mint, mid-right */}
      <div
        className="absolute blob-drift-2"
        style={{
          top: '30%',
          right: '-12%',
          width: '44rem',
          height: '44rem',
          transform: `translate3d(0, ${y2}px, 0)`,
          background:
            'radial-gradient(circle at 70% 40%, rgba(204,250,214,0.7), rgba(204,250,214,0) 65%)',
          filter: 'blur(90px)',
          willChange: 'transform',
        }}
      />

      {/* Blob 3, pink, bottom-left (stronger) */}
      <div
        className="absolute blob-drift-3"
        style={{
          bottom: '-6%',
          left: '20%',
          width: '56rem',
          height: '56rem',
          transform: `translate3d(0, ${y3}px, 0)`,
          background:
            'radial-gradient(circle at 50% 50%, rgba(255,143,175,0.4), rgba(204,250,214,0.25) 45%, rgba(255,255,255,0) 70%)',
          filter: 'blur(100px)',
          willChange: 'transform',
        }}
      />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.035] dark:opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(12,10,19,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(12,10,19,0.5) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage:
            'radial-gradient(ellipse at center, black 0%, transparent 80%)',
          WebkitMaskImage:
            'radial-gradient(ellipse at center, black 0%, transparent 80%)',
        }}
      />

      {/* Grain */}
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
