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

/**
 * Product listing for a search word. `base` is the page's own path: /search keeps `q` in the link,
 * a category page (/category/shoes) doesn't. Default sort and page 1 are left out so links stay clean.
 */
export async function SearchView({ q, page: pageIn, sort: sortIn, base = '/search', title }: { q: string; page?: string; sort?: string; base?: string; title?: string }) {
  const page = Math.max(1, Number(pageIn ?? 1) || 1);
  const sort = SORTS.some(([k]) => k === sortIn) ? sortIn! : 'relevance';
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
  const qs = (extra: { sort?: string; page?: string }) => {
    const p = new URLSearchParams();
    if (base === '/search') p.set('q', q);
    const s = extra.sort ?? sort;
    if (s !== 'relevance') p.set('sort', s);
    const pg = extra.page ?? String(page);
    if (pg !== '1') p.set('page', pg);
    const str = p.toString();
    return str ? `${base}?${str}` : base;
  };

  return (
    <div className="mx-auto flex max-w-[1920px] flex-col gap-4 px-3 py-5 md:px-6 2xl:px-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">{title ?? `“${q}”`} <span className="text-base font-medium text-muted">{data.total ? `— প্রায় ${toBanglaDigits(data.total)}টি পণ্য` : ''}</span></h1>
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 min-[1800px]:grid-cols-7">{data.items.map((p) => <ProductCard key={p.market + p.id} p={p} />)}</div>
      {data.items.length > 0 && (
        <div className="flex justify-center gap-2">
          {page > 1 && <Link className="btn-outline" href={qs({ page: String(page - 1) })}>← আগের</Link>}
          <Link className="btn-gold" href={qs({ page: String(page + 1) })}>আরও দেখুন →</Link>
        </div>
      )}
    </div>
  );
}
