import Link from 'next/link';
import { formatBdt } from '@deshtori/shared';
import type { SearchItem } from '@/lib/types';

/** Corner tag shown on the photo — never the marketplace name. Only tags we have data for. */
const BEST_SELLING_MIN = 1000;
const tagOf = (p: SearchItem) => ((p.soldCount ?? 0) >= BEST_SELLING_MIN ? 'বেশি বিক্রি' : null);

export function ProductCard({ p }: { p: SearchItem }) {
  return (
    <Link href={`/p/${p.market}/${p.id}`} className="card group flex h-full flex-col overflow-hidden transition duration-200 hover:-translate-y-1 hover:border-gold hover:shadow-gold active:translate-y-0 active:scale-[.98]">
      <span className="relative block aspect-square overflow-hidden bg-ivory-ph">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.image} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        {tagOf(p) && <span className="chip absolute left-2 top-2 bg-gold text-navy shadow">{tagOf(p)}</span>}
      </span>
      <span className="flex flex-1 flex-col gap-2 p-2.5">
        <span className="line-clamp-2 min-h-[2.6em] text-[13px] font-medium leading-[1.3]">{p.title}</span>
        <span className="mt-auto flex items-center justify-between gap-2 rounded-xl bg-gradient-to-b from-[#F3FAF6] to-[#DDEFE5] px-2.5 py-1.5 shadow-[inset_0_1px_0_#fff,0_2px_4px_-2px_rgba(15,107,79,.4)]">
          <b className="text-base text-emerald">{formatBdt(p.pricePaisa)}</b>
          {!!p.soldCount && <span className="text-[11px] text-muted">{formatBdt(p.soldCount * 100, { symbol: false })} বিক্রি</span>}
        </span>
      </span>
    </Link>
  );
}
