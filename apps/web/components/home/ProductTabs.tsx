'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { SearchItem } from '@/lib/types';
import { recentSearches } from '@/lib/recent';
import { ProductCard } from '../ProductCard';

interface Tab { key: string; label: string; q: string; sort?: 'sales' | 'price_asc' }
const BASE_TABS: Tab[] = [
  { key: 'trending', label: '🔥 ট্রেন্ডিং', q: 'trending' },
  { key: 'hot-sale', label: '⭐ বেশি বিক্রি', q: 'best seller', sort: 'sales' },
  { key: 'deal', label: '⚡ হট ডিল', q: 'hot deal', sort: 'sales' },
  { key: 'discount', label: '🏷 ডিসকাউন্ট', q: 'discount sale', sort: 'price_asc' },
];
const SHOW = 10;
const ROTATE_MS = 9000;

/** Homepage products: rotates between "for you" (the customer's last search), trending, best sellers, deals and discounts. */
export function ProductTabs({ initial }: { initial: SearchItem[] }) {
  const [tabs, setTabs] = useState(BASE_TABS);
  const [active, setActive] = useState('trending');
  const [data, setData] = useState<Record<string, SearchItem[]>>({ trending: initial });
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const last = recentSearches()[0];
    if (last) {
      setTabs([{ key: 'for-you', label: `💛 আপনার জন্য`, q: last }, ...BASE_TABS]);
      setActive('for-you');
    }
  }, []);

  const tab = tabs.find((t) => t.key === active) ?? tabs[0];
  useEffect(() => {
    if (data[tab.key]) return;
    let live = true;
    api<{ items: SearchItem[] }>(`/products/search?q=${encodeURIComponent(tab.q)}${tab.sort ? `&sort=${tab.sort}` : ''}`)
      .then((r) => live && setData((d) => ({ ...d, [tab.key]: r.items })))
      .catch(() => live && setData((d) => ({ ...d, [tab.key]: [] })));
    return () => {
      live = false;
    };
  }, [tab, data]);

  useEffect(() => {
    if (touched || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setActive((k) => tabs[(tabs.findIndex((x) => x.key === k) + 1) % tabs.length].key), ROTATE_MS);
    return () => clearInterval(t);
  }, [tabs, touched]);

  const items = (data[tab.key] ?? []).slice(0, SHOW);
  const loading = !data[tab.key];

  return (
    <section className="card p-5" onMouseEnter={() => setTouched(true)} onTouchStart={() => setTouched(true)}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto flex items-center gap-2.5 text-xl font-bold"><span className="h-5 w-1.5 rounded bg-gold" />আপনার পছন্দের পণ্য</h2>
        <div role="tablist" className="flex gap-1.5 overflow-x-auto pb-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={t.key === tab.key}
              onClick={() => {
                setTouched(true);
                setActive(t.key);
              }}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-bold transition active:scale-95 ${t.key === tab.key ? 'bg-navy text-white shadow-md' : 'bg-ivory text-navy hover:bg-gold-chip'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-busy="true">
          {Array.from({ length: SHOW }, (_, n) => <div key={n} className="aspect-[3/4] animate-pulse rounded-2xl bg-ivory-ph" />)}
        </div>
      ) : items.length ? (
        <div key={tab.key} className="dt-fade grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{items.map((p) => <ProductCard key={p.market + p.id} p={p} />)}</div>
      ) : (
        <p className="text-muted">এই মুহূর্তে পণ্য লোড করা যাচ্ছে না। একটু পরে আবার দেখুন।</p>
      )}
      <div className="mt-5 flex justify-center">
        <Link href={`/search?q=${encodeURIComponent(tab.q)}${tab.sort ? `&sort=${tab.sort}` : ''}`} className="btn-navy px-8">আরো পণ্য দেখুন →</Link>
      </div>
    </section>
  );
}
