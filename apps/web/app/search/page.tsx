import type { Metadata } from 'next';
import { DEFAULT_CATEGORIES } from '@/lib/categories';
import Link from 'next/link';
import { API_URL } from '@/lib/api';
import type { SearchItem } from '@/lib/types';
import { ProductCard } from '@/components/ProductCard';
import { toBanglaDigits } from '@deshtori/shared';

const SORTS = [
  ['relevance', 'প্রাসঙ্গিক'],
  ['sales', 'বেশি বিক্রি'],
  ['price_asc', 'দাম: কম → বেশি'],
  ['price_desc', 'দাম: বেশি → কম'],
] as const;

const CAT_BN = new Map(DEFAULT_CATEGORIES.map((c) => [(c.query ?? "").toLowerCase(), c.name]));

export function generateMetadata({ searchParams }: { searchParams: { q?: string; page?: string; sort?: string } }): Metadata {
  const q = (searchParams.q ?? '').trim();
  if (!q) return { title: 'পণ্য খুঁজুন | DeshTori' };
  const name = CAT_BN.get(q.toLowerCase()) ?? q;
  return {
    title: `${name} চীন থেকে কিনুন, বাংলা টাকায় দাম | DeshTori`,
    description: `চীনের কারখানা ও মূল সাপ্লায়ারের ${name} বাংলা টাকায় লাইভ দামে অর্ডার করুন। Air ৭–১৫ দিন, Sea ৪৫–৬৫ দিনে ঘরে ডেলিভারি।`,
    alternates: { canonical: `/search?q=${encodeURIComponent(q)}` },
    // sort / page variants are the same listing; keep them out of the index
    robots: searchParams.sort || (searchParams.page && searchParams.page !== '1') ? { index: false, follow: true } : undefined,
  };
}

export default async function SearchPage({ searchParams }: { searchParams: { q?: string; page?: string; sort?: string } }) {
  const q = (searchParams.q ?? '').trim();
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const sort = SORTS.some(([k]) => k === searchParams.sort) ? searchParams.sort! : 'relevance';
  let data: { items: SearchItem[]; total: number; blocked?: boolean } = { items: [], total: 0 };
  let failed = false;
  if (q.length >= 2) {
    try {
      const r = await fetch(`${API_URL}/products/search?${new URLSearchParams({ q, page: String(page), sort, market: 'ALL' })}`, { cache: 'no-store' });
      if (r.ok) data = await r.json();
      else failed = true;
    } catch {
      failed = true;
    }
  }
  const qs = (extra: Record<string, string>) => `/search?${new URLSearchParams({ q, sort, ...extra })}`;

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-3 py-5 md:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">“{q}” <span className="text-base font-medium text-muted">{data.total ? `— প্রায় ${toBanglaDigits(data.total)}টি পণ্য` : ''}</span></h1>
        <nav aria-label="সাজানো" className="flex flex-wrap gap-2">
          {SORTS.map(([k, label]) => (
            <Link
              key={k}
              href={qs({ sort: k, page: '1' })}
              aria-current={sort === k ? 'true' : undefined}
              className={`chip min-h-[36px] select-none border px-3.5 text-[13px] transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-1 active:scale-95 ${
                sort === k
                  ? 'border-navy bg-navy text-white shadow-[0_4px_12px_-4px_rgba(14,42,107,.55)] hover:bg-navy/90 active:bg-navy/80'
                  : 'border-ivory-line bg-white text-navy hover:-translate-y-px hover:border-navy/40 hover:bg-ivory-soft hover:shadow-sm active:translate-y-0 active:bg-ivory-ph'
              }`}
            >
              {sort === k && <span aria-hidden="true" className="mr-1">✓</span>}
              {label}
            </Link>
          ))}
        </nav>
      </div>
      {data.blocked && <div className="card p-6 text-danger">এই ধরনের পণ্য বাংলাদেশে আমদানির অনুমতি নেই, তাই দেখানো হচ্ছে না।</div>}
      {failed && <div className="card p-6">সার্চ এই মুহূর্তে কাজ করছে না। একটু পরে চেষ্টা করুন, অথবা <Link href="/quote" className="font-bold text-emerald">কোটেশন চান</Link>।</div>}
      {!failed && !data.blocked && q.length >= 2 && data.items.length === 0 && (
        <div className="card p-6">কিছু পাওয়া যায়নি। অন্য শব্দে বা ইংরেজিতে খুঁজে দেখুন, অথবা ছবি দিয়ে খুঁজুন।</div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">{data.items.map((p) => <ProductCard key={p.market + p.id} p={p} />)}</div>
      {data.items.length > 0 && (
        <div className="flex justify-center gap-2">
          {page > 1 && <Link className="btn-outline" href={qs({ page: String(page - 1) })}>← আগের</Link>}
          <Link className="btn-gold" href={qs({ page: String(page + 1) })}>আরও দেখুন →</Link>
        </div>
      )}
    </div>
  );
}
