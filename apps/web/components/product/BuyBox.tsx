'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatBdt, quoteCheckout, toBanglaDigits, DEFAULT_ADVANCE_PLANS } from '@deshtori/shared';
import type { ProductDetail, PublicSettings } from '@/lib/types';
import { api, ApiError, errText } from '@/lib/api';

export function BuyBox({ product: p, settings }: { product: ProductDetail; settings: PublicSettings | null }) {
  const router = useRouter();
  const plans = settings?.advancePlans ?? DEFAULT_ADVANCE_PLANS;
  const propKeys = useMemo(() => Object.keys(p.skus[0]?.props ?? {}), [p.skus]);
  const firstKey = propKeys[0];
  const firstValues = useMemo(() => [...new Set(p.skus.map((s) => s.props[firstKey]))], [p.skus, firstKey]);
  const [group, setGroup] = useState(firstValues[0]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [ship, setShip] = useState<'AIR' | 'SEA'>('AIR');
  const [planIdx, setPlanIdx] = useState(plans.length - 1);
  const [freightOpen, setFreightOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const totalQty = Object.values(qty).reduce((a, b) => a + b, 0);
  const tiers = [...p.priceTiers].sort((a, b) => a.minQty - b.minQty);
  const tierIdx = tiers.reduce((acc, t, i) => (totalQty >= t.minQty ? i : acc), 0);
  const ratio = tiers.length ? tiers[tierIdx].pricePaisa / tiers[0].pricePaisa : 1;
  const unit = (base: number) => Math.ceil((base * ratio) / 100) * 100;
  const nextTier = tiers[tierIdx + 1];

  const lines = p.skus.filter((s) => qty[s.skuId]).map((s) => ({ unitPaisa: unit(s.pricePaisa), qty: qty[s.skuId] }));
  const q = quoteCheckout(lines, plans[planIdx]);
  const fromPrice = Math.min(...p.skus.map((s) => s.pricePaisa));
  const rates = settings?.freight ?? [];
  const rateText = rates.length ? rates.slice(0, 2).map((r) => formatBdt(ship === 'AIR' ? r.airPaisa : r.seaPaisa)).join(' / ') + ' প্রতি কেজি' : '—';

  const change = (skuId: string, d: number) => setQty((m) => ({ ...m, [skuId]: Math.max(0, (m[skuId] ?? 0) + d) }));

  const addToCart = async (goCart: boolean) => {
    if (!totalQty) return setMsg('আগে পরিমাণ বাছাই করুন');
    setBusy(true);
    setMsg(null);
    try {
      for (const s of p.skus) if (qty[s.skuId]) await api('/cart', { method: 'POST', json: { productId: p.id, skuId: s.skuId, qty: qty[s.skuId], shipMode: ship } });
      if (goCart) router.push('/cart');
      else setMsg('✓ কার্টে রাখা হয়েছে');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
      else setMsg(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* price tiers */}
      <div className="card flex flex-col gap-3 p-5">
        <div className="flex items-baseline gap-3"><b className="text-4xl">{formatBdt(fromPrice)}</b><span className="text-sm text-muted">থেকে শুরু · প্রতি পিস</span></div>
        {nextTier && (
          <div className="rounded-xl border border-[#EBD597] bg-gold-chip px-4 py-2 text-center text-sm text-gold-ink">
            💡 আরও <b>{toBanglaDigits(nextTier.minQty - totalQty)} পিস</b> নিলে প্রতি পিসে <b>{toBanglaDigits(Math.round((1 - nextTier.pricePaisa / tiers[0].pricePaisa) * 100))}% সাশ্রয়</b>
          </div>
        )}
        {tiers.length > 1 && (
          <div className="grid grid-cols-3 gap-2.5">
            {tiers.map((t, i) => (
              <div key={t.minQty} className={`flex min-h-[84px] flex-col items-center justify-center rounded-xl border-2 text-center ${i === tierIdx ? 'border-emerald-dark bg-emerald text-white' : 'border-[#EBD597] bg-[#FFFCF4] text-gold-ink'}`}>
                <b className="text-xl">{formatBdt(t.pricePaisa)}</b>
                <span className="text-xs">{toBanglaDigits(t.minQty)}+ পিস</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* variants */}
      <div className="card flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2"><span className="text-muted">{firstKey}:</span><b className="rounded-lg bg-emerald-light px-2.5 text-emerald-dark">{group}</b></div>
        <div className="flex flex-wrap gap-2">
          {firstValues.map((v) => (
            <button key={v} onClick={() => setGroup(v)} aria-pressed={group === v} className={`min-h-[44px] rounded-xl border-2 px-4 font-semibold ${group === v ? 'border-emerald bg-emerald-light' : 'border-ivory-line bg-white'}`}>{v}</button>
          ))}
        </div>
        <div className="overflow-hidden rounded-xl border border-ivory-line">
          {p.skus.filter((s) => s.props[firstKey] === group).map((s) => (
            <div key={s.skuId} className="grid grid-cols-[1.4fr_1fr_1.3fr] items-center gap-2 border-t border-ivory-line px-3 py-2.5 first:border-t-0">
              <b className="text-sm">{propKeys.slice(1).map((k) => s.props[k]).join(' · ') || s.props[firstKey]}</b>
              <b>{formatBdt(unit(s.pricePaisa))}</b>
              <span className="flex flex-col items-center gap-1">
                {s.stock <= 0 ? (
                  <span className="text-sm text-danger">স্টক শেষ</span>
                ) : (
                  <span className="flex items-center rounded-xl border border-emerald">
                    <button onClick={() => change(s.skuId, -1)} aria-label="কমান" className="h-10 w-10 text-xl text-emerald">−</button>
                    <span className="min-w-[34px] text-center font-bold">{toBanglaDigits(qty[s.skuId] ?? 0)}</span>
                    <button onClick={() => change(s.skuId, 1)} aria-label="বাড়ান" className="h-10 w-10 text-xl text-emerald">+</button>
                  </span>
                )}
                <span className="text-xs text-muted">স্টক {toBanglaDigits(s.stock)}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* shipping + summary */}
      <div className="card flex flex-col gap-4 p-5">
        <div className="grid grid-cols-2 gap-2.5">
          {(['AIR', 'SEA'] as const).map((m) => (
            <button key={m} onClick={() => setShip(m)} aria-pressed={ship === m} className={`flex min-h-[96px] flex-col items-center justify-center rounded-2xl border-2 ${ship === m ? 'border-emerald bg-emerald-light text-emerald-dark' : 'border-ivory-line bg-white'}`}>
              <span className="text-2xl">{m === 'AIR' ? '✈' : '⚓'}</span>
              <b>{m === 'AIR' ? 'Air' : 'Sea'}</b>
              <span className="text-xs text-muted">{m === 'AIR' ? '৭–১৫ দিন' : '৪৫–৬৫ দিন'}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 border-t border-ivory-line pt-3 text-[15px]">
          <span className="text-sm font-semibold">অ্যাডভান্স পেমেন্ট</span>
          <div className="grid grid-cols-3 gap-2">
            {plans.map((pl, i) => (
              <button key={pl.percent} onClick={() => setPlanIdx(i)} aria-pressed={planIdx === i} className={`min-h-[52px] rounded-xl border-2 ${planIdx === i ? 'border-navy bg-navy text-white' : 'border-ivory-line bg-white'}`}>
                <b className="block text-lg">{toBanglaDigits(pl.percent)}%</b>
                <span className="text-xs">{pl.discountPct ? `${toBanglaDigits(pl.discountPct)}% ছাড়` : 'ছাড় নেই'}</span>
              </button>
            ))}
          </div>
          <div className="flex justify-between"><span>পরিমাণ</span><b>{toBanglaDigits(q.itemCount)} পিস</b></div>
          <div className="flex justify-between"><span>পণ্যের দাম</span><b>{formatBdt(q.subtotal)}</b></div>
          <div className="flex justify-between text-emerald"><span>অ্যাডভান্স ছাড়</span><b>{formatBdt(-q.advanceDiscount)}</b></div>
          <div className="flex justify-between"><span>এখন দিন ({toBanglaDigits(plans[planIdx].percent)}%)</span><b className="text-xl text-emerald">{formatBdt(q.payNow)}</b></div>
          <div className="flex justify-between text-muted"><span>পণ্য হাতে পেয়ে</span><span>{formatBdt(q.payOnArrival)}</span></div>
        </div>
        <div className="flex flex-col gap-1.5 rounded-2xl border-[1.5px] border-dashed border-gold bg-[#FFFCF4] p-3.5">
          <span className="flex items-center justify-between"><b>শিপিং চার্জ ({ship === 'AIR' ? 'Air' : 'Sea'})</b><button onClick={() => setFreightOpen(true)} className="text-sm font-bold text-gold-ink">বিস্তারিত ↗</button></span>
          <b className="text-lg text-emerald">{rateText}</b>
        </div>
        <p className="text-xs leading-relaxed text-muted">*** উল্লেখিত পণ্যের ওজন সম্পূর্ণ সঠিক নয়, আনুমানিক মাত্র। বাংলাদেশে আসার পর প্রকৃত ওজন মেপে শিপিং চার্জ হিসাব করা হবে।</p>
        {msg && <p role="status" className="text-sm font-semibold">{msg}</p>}
        <div className="flex gap-2.5">
          <button disabled={busy} onClick={() => addToCart(false)} className="btn-navy flex-1">🛒 কার্টে রাখুন</button>
          <button disabled={busy} onClick={() => addToCart(true)} className="btn-gold flex-1">⚡ এখনই কিনুন</button>
        </div>
      </div>

      {freightOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#091634]/55 p-4" onClick={() => setFreightOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="শিপিং চার্জ" className="flex max-h-[88vh] w-full max-w-[620px] flex-col overflow-hidden rounded-3xl bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b-[3px] border-gold bg-emerald p-5 text-white">
              <h2 className="flex-1 text-2xl font-bold">শিপিং চার্জ ({ship === 'AIR' ? 'AIR' : 'SEA'})</h2>
              <button onClick={() => setFreightOpen(false)} aria-label="বন্ধ করুন" className="h-11 w-11 text-2xl">×</button>
            </div>
            <div className="flex flex-col gap-3 overflow-y-auto bg-[#FBF8F1] p-5">
              {rates.map((r) => (
                <div key={r.id} className="flex gap-3 rounded-2xl border border-ivory-line bg-white p-4">
                  <span className="text-emerald">✓</span>
                  <span className="flex flex-col gap-1.5"><b className="text-lg">{r.nameBn} – {formatBdt(ship === 'AIR' ? r.airPaisa : r.seaPaisa)} প্রতি কেজি</b><span className="leading-relaxed text-muted">{r.itemsBn}</span></span>
                </div>
              ))}
            </div>
            <div className="flex justify-end border-t border-ivory-line p-4"><button onClick={() => setFreightOpen(false)} className="btn bg-emerald text-white">বুঝেছি</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
