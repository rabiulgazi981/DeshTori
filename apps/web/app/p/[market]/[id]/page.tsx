import { notFound } from 'next/navigation';
import { API_URL } from '@/lib/api';
import type { ProductDetail, PublicSettings } from '@/lib/types';
import { BuyBox } from '@/components/product/BuyBox';
import { Gallery } from '@/components/product/Gallery';
import { toBanglaDigits } from '@deshtori/shared';

async function load(market: string, id: string) {
  const [p, s] = await Promise.all([
    fetch(`${API_URL}/products/${market}/${id}`, { cache: 'no-store' }),
    fetch(`${API_URL}/settings/public`, { next: { revalidate: 60 } }),
  ]);
  if (p.status === 404) return null;
  if (!p.ok) throw new Error('PRODUCT_LOAD_FAILED');
  return { product: (await p.json()) as ProductDetail, settings: s.ok ? ((await s.json()) as PublicSettings) : null };
}

export async function generateMetadata({ params }: { params: { market: string; id: string } }) {
  const d = await load(params.market, params.id).catch(() => null);
  return { title: d ? `${d.product.title} – DeshTori` : 'DeshTori' };
}

export default async function ProductPage({ params }: { params: { market: string; id: string } }) {
  const data = await load(params.market, params.id);
  if (!data) notFound();
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
