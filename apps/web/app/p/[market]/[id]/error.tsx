'use client';
import { useEffect } from 'react';
import { useParams } from 'next/navigation';

/** Last-resort boundary for the product page (e.g. a render error) — never a blank screen. */
export default function ProductPageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ market: string; id: string }>();
  useEffect(() => {
    console.error('[product page]', error);
  }, [error]);
  const m = String(params?.market ?? '').toUpperCase();
  const id = String(params?.id ?? '');
  const src = !/^\d+$/.test(id) ? null : m === 'M1688' || m === '1688' ? `https://detail.1688.com/offer/${id}.html` : m === 'TMALL' ? `https://detail.tmall.com/item.htm?id=${id}` : `https://item.taobao.com/item.htm?id=${id}`;
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="card flex flex-col items-center gap-4 p-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gold-chip text-3xl" aria-hidden="true">⏳</span>
        <h1 className="text-xl font-bold">পণ্যের পেজটি খুলতে সমস্যা হয়েছে</h1>
        <p className="leading-relaxed text-muted">আবার চেষ্টা করুন। সমস্যা থাকলে মূল পণ্যটি দেখে আমাদের কোটেশন চান।</p>
        <div className="flex flex-wrap justify-center gap-2.5">
          <button onClick={reset} className="btn-gold min-w-[150px]">↻ আবার চেষ্টা করুন</button>
          {src && <a href={src} target="_blank" rel="noopener noreferrer" className="btn-outline">মূল পণ্যটি দেখুন ↗</a>}
        </div>
      </div>
    </div>
  );
}
