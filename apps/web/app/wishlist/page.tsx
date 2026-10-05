'use client';
import Link from 'next/link';
import { formatBdt } from '@deshtori/shared';
import { api } from '@/lib/api';
import { useCustomer } from '@/components/useCustomer';

interface W { id: string; market: string; sourceId: string; title: string; image: string | null; pricePaisa: number }

export default function Wishlist() {
  const { data, reload } = useCustomer<W[]>('/wishlist');
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-3 py-5 md:px-6">
      <h1 className="text-2xl font-bold">উইশলিস্ট</h1>
      {data && !data.length && <p className="card p-8 text-center text-muted">পছন্দের পণ্য ♡ চাপ দিয়ে এখানে রাখুন। <Link href="/" className="font-bold underline">পণ্য খুঁজুন</Link></p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {data?.map((w) => (
          <div key={w.id} className="card flex flex-col overflow-hidden">
            <Link href={`/p/${w.market}/${w.sourceId}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {w.image ? <img src={w.image} alt="" className="aspect-square w-full object-cover" loading="lazy" /> : <span className="block aspect-square bg-ivory-ph" />}
              <p className="line-clamp-2 px-3 pt-2 text-sm">{w.title}</p>
            </Link>
            <div className="flex items-center justify-between px-3 pb-3 pt-1">
              <b className="text-emerald">{formatBdt(w.pricePaisa)}</b>
              <button aria-label="মুছুন" className="text-danger" onClick={async () => { await api(`/wishlist/${w.id}`, { method: 'DELETE' }); await reload(); }}>✕</button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">দাম রাখার সময়ের; পণ্যের পেজে গেলে বর্তমান দাম দেখাবে।</p>
    </div>
  );
}
