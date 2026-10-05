'use client';
import { useEffect, useState } from 'react';
import type { Popup as P } from '@/lib/content';

/** Admin popup, shown once per day per visitor. */
export function Popup({ p }: { p: P | null }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!p?.on) return;
    const key = `dt-popup-${new Date().toDateString()}-${p.title ?? ''}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch {
      /* storage blocked: still show */
    }
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, [p]);
  if (!open || !p) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={p.title ?? 'অফার'} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
      <div className="card relative w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <button aria-label="বন্ধ করুন" onClick={() => setOpen(false)} className="absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-xl">✕</button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.image && <img src={p.image} alt="" className="block max-h-72 w-full object-cover" />}
        <div className="flex flex-col gap-2 p-5">
          {p.title && <h2 className="text-xl font-bold">{p.title}</h2>}
          {p.text && <p className="whitespace-pre-line text-muted">{p.text}</p>}
          {p.link && <a href={p.link} className="btn-gold self-start">{p.button || 'দেখুন'}</a>}
        </div>
      </div>
    </div>
  );
}
