import { cache } from 'react';
import { notFound } from 'next/navigation';
import { API_URL } from '@/lib/api';
import type { Market, ProductDetail, PublicSettings } from '@/lib/types';
import { BuyBox } from '@/components/product/BuyBox';
import { Gallery } from '@/components/product/Gallery';
import { toBanglaDigits } from '@deshtori/shared';
import { ProductError, type ProductErrorKind } from './ProductError';

/** URL market segment → API market (accepts any casing, and 1688 for M1688). */
const MARKETS: Record<string, Market> = { M1688: 'M1688', '1688': 'M1688', TAOBAO: 'TAOBAO', TMALL: 'TMALL' };

const originalUrl = (market: Market, id: string) =>
  market === 'M1688' ? `https://detail.1688.com/offer/${id}.html` : market === 'TMALL' ? `https://detail.tmall.com/item.htm?id=${id}` : `https://item.taobao.com/item.htm?id=${id}`;

type Loaded = { ok: true; product: ProductDetail; settings: PublicSettings | null } | { ok: false; kind: ProductErrorKind };

/** One API call per request: metadata and page share it (React cache). Never throws. */
const load = cache(async (market: Market, id: string): Promise<Loaded> => {
  const settingsP = fetch(`${API_URL}/settings/public`, { next: { revalidate: 60 } })
    .then((s) => (s.ok ? (s.json() as Promise<PublicSettings>) : null))
    .catch(() => null);
  try {
    const p = await fetch(`${API_URL}/products/${market}/${id}`, { cache: 'no-store' });
    if (!p.ok) {
      const body = await p.text().catch(() => '');
      console.error(`[product] ${market}/${id} → HTTP ${p.status} ${body.slice(0, 300)}`);
      return { ok: false, kind: p.status === 404 ? (body.includes('PRODUCT_NOT_ALLOWED') ? 'blocked' : 'not_found') : 'failed' };
    }
    return { ok: true, product: (await p.json()) as ProductDetail, settings: await settingsP };
  } catch (e) {
    console.error(`[product] ${market}/${id} → ${(e as Error).message}`);
    return { ok: false, kind: 'failed' };
  }
});

export async function generateMetadata({ params }: { params: { market: string; id: string } }) {
  const market = MARKETS[params.market.toUpperCase()];
  const d = market ? await load(market, params.id) : null;
  return { title: d?.ok ? `${d.product.title} – DeshTori` : 'DeshTori' };
}

export default async function ProductPage({ params }: { params: { market: string; id: string } }) {
  const market = MARKETS[params.market.toUpperCase()];
  if (!market || !/^\d{1,20}$/.test(params.id)) notFound();
  const data = await load(market, params.id);
  if (!data.ok || !data.product.skus?.length) return <ProductError kind={data.ok ? 'failed' : data.kind} sourceUrl={originalUrl(market, params.id)} />;
  const { product: p, settings } = data;
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-5 px-3 py-5 md:px-6">
      <div className="flex flex-wrap items-start gap-5">
        <div className="min-w-0 flex-[1_1_340px]">
          <Gallery images={p.images} />
        </div>
        <div className="flex min-w-0 flex-[2_1_520px] flex-col gap-4">
          <div className="card flex flex-col gap-3 p-5">
            <h1 className="text-xl font-bold leading-snug md:text-2xl">{p.title}</h1>
            <div className="flex flex-wrap gap-2">
              {!!p.soldCount && <span className="chip bg-emerald-light text-emerald-dark">🔥 {toBanglaDigits(p.soldCount)} বিক্রি</span>}
              <span className="chip bg-ivory-soft">কোনো সর্বনিম্ন পরিমাণ নেই</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
              {Object.entries(p.attributes ?? {}).slice(0, 4).map(([k, v]) => (
                <div key={k}><dt className="inline text-muted">{k}: </dt><dd className="inline font-semibold">{v}</dd></div>
              ))}
            </dl>
          </div>
          <BuyBox product={p} settings={settings} />
          <div className="card flex items-center gap-3 p-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy font-bold text-gold-light">S</span>
            <span className="flex flex-col"><b>{p.seller.name ?? 'বিক্রেতা'}</b><span className="text-sm text-muted">{p.seller.location}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
