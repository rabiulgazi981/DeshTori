import Link from 'next/link';
import { formatBdt } from '@deshtori/shared';
import type { SearchItem } from '@/lib/types';

/** Corner tag shown on the photo — never the marketplace name. Only tags we have data for. */
const BEST_SELLING_MIN = 1000;
const tagOf = (p: SearchItem) => ((p.soldCount ?? 0) >= BEST_SELLING_MIN ? 'বেশি বিক্রি' : null);

export function ProductCard({ p }: { p: SearchItem }) {
  return (
    <Link href={`/p/${p.market}/${p.id}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5">
      <span className="relative block aspect-square bg-ivory-ph">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.image} alt="" loading="lazy" className="h-full w-full object-cover" />
        {tagOf(p) && <span className="chip absolute left-2 top-2 bg-gold text-navy">{tagOf(p)}</span>}
      </span>
      <span className="flex flex-col gap-1 p-3">
        <b className="text-lg text-emerald">{formatBdt(p.pricePaisa)}</b>
        <span className="line-clamp-2 text-[13px] leading-snug">{p.title}</span>
        {!!p.soldCount && <span className="text-xs text-muted">{formatBdt(p.soldCount * 100, { symbol: false })} বিক্রি</span>}
      </span>
    </Link>
  );
}
