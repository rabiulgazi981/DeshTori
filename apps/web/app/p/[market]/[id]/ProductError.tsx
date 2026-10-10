'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export type ProductErrorKind = 'failed' | 'not_found' | 'blocked';

const TEXT: Record<ProductErrorKind, { title: string; body: string }> = {
  failed: {
    title: 'পণ্যের তথ্য এই মুহূর্তে আনা যাচ্ছে না',
    body: 'সাপ্লায়ারের সার্ভার থেকে উত্তর আসেনি। একটু পরে আবার চেষ্টা করুন, অথবা নিচের লিংকে মূল পণ্যটি দেখে আমাদের কোটেশন চান।',
  },
  not_found: {
    title: 'পণ্যটি পাওয়া যায়নি',
    body: 'পণ্যটি হয়তো সরিয়ে ফেলা হয়েছে বা আর বিক্রি হচ্ছে না। মূল লিংকে একবার দেখে নিন, অথবা অন্য পণ্য খুঁজুন।',
  },
  blocked: {
    title: 'এই পণ্যটি দেখানো হচ্ছে না',
    body: 'এই ধরনের পণ্য বাংলাদেশে আমদানির অনুমতি নেই।',
  },
};

/** Shown instead of a blank page / 404 when the product cannot be loaded. */
export function ProductError({ kind, sourceUrl, retry = true }: { kind: ProductErrorKind; sourceUrl?: string; retry?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tries, setTries] = useState(0);
  const t = TEXT[kind];
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="card flex flex-col items-center gap-4 p-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gold-chip text-3xl" aria-hidden="true">{kind === 'failed' ? '⏳' : kind === 'blocked' ? '🚫' : '🔍'}</span>
        <h1 className="text-xl font-bold">{t.title}</h1>
        <p className="leading-relaxed text-muted">{t.body}</p>
        {tries > 0 && !pending && kind === 'failed' && <p role="status" className="text-sm font-semibold text-danger">আবারও আনা গেল না। কিছুক্ষণ পর চেষ্টা করুন।</p>}
        <div className="flex flex-wrap justify-center gap-2.5">
          {retry && kind !== 'blocked' && (
            <button
              disabled={pending}
              onClick={() => start(() => { setTries((n) => n + 1); router.refresh(); })}
              className="btn-gold min-w-[150px]"
            >
              {pending ? 'আবার চেষ্টা হচ্ছে…' : '↻ আবার চেষ্টা করুন'}
            </button>
          )}
          {sourceUrl && kind !== 'blocked' && (
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="btn-outline">মূল পণ্যটি দেখুন ↗</a>
          )}
        </div>
        <div className="flex flex-wrap justify-center gap-4 text-sm font-semibold">
          <Link href="/quote" className="text-emerald hover:underline">কোটেশন চান</Link>
          <Link href="/" className="text-emerald hover:underline">হোমে ফিরুন</Link>
        </div>
      </div>
    </div>
  );
}
