import Link from 'next/link';
import { formatBdt } from '@deshtori/shared';
import type { SearchItem } from '@/lib/types';

export function ProductCard({ p }: { p: SearchItem }) {
  return (
    <Link href={`/p/${p.market}/${p.id}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5">
      <span className="relative block aspect-square bg-ivory-ph">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.image} alt="" loading="lazy" className="h-full w-full object-cover" />
        {p.market !== 'M1688' && <span className="chip absolute left-2 top-2 bg-navy text-white">{p.market === 'TMALL' ? 'Tmall' : 'Taobao'}</span>}
      </span>
      <span className="flex flex-col gap-1 p-3">
        <b className="text-lg text-emerald">{formatBdt(p.pricePaisa)}</b>
        <span className="line-clamp-2 text-[13px] leading-snug">{p.title}</span>
        {!!p.soldCount && <span className="text-xs text-muted">{formatBdt(p.soldCount * 100, { symbol: false })} বিক্রি</span>}
      </span>
    </Link>
  );
}
