'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatBdt, quoteCheckout, toBanglaDigits } from '@deshtori/shared';
import { api, ApiError, errText } from '@/lib/api';
import { PayBox } from '@/components/PayBox';

interface CartRow { id: string; label: string; qty: number; shipMode: 'AIR' | 'SEA'; unitPaisa: number; inStock: boolean }
interface CartGroup { productId: string; title: string; image?: string; market: string; sourceId: string; rows: CartRow[] }
interface CartView { groups: CartGroup[]; advancePlans: { percent: number; discountPct: number }[] }
interface Address { id: string; label: string; name: string; phone: string; district: string; area: string; line: string }
interface Placed { orders: { code: string; shipMode: string; payNowPaisa: number }[]; payNowTotal: number }

const DELIVERY = [
  ['COURIER_HOME', 'কুরিয়ারে বাসায়'],
  ['OFFICE_PICKUP', 'অফিস থেকে নেব'],
  ['CONDITION_COD', 'কন্ডিশন / COD'],
  ['TRUCK', 'ট্রাক / কভার ভ্যান'],
] as const;

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartView | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [plan, setPlan] = useState(100);
  const [coupon, setCoupon] = useState('');
  const [addressId, setAddressId] = useState('');
  const [delivery, setDelivery] = useState<(typeof DELIVERY)[number][0]>('COURIER_HOME');
  const [newAddr, setNewAddr] = useState({ label: 'বাসা', name: '', phone: '', district: 'ঢাকা', area: '', line: '' });
  const [placed, setPlaced] = useState<Placed | null>(null);
  const [wallet, setWallet] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, a, w] = await Promise.all([api<CartView>('/cart'), api<Address[]>('/account/addresses'), api<{ balancePaisa: number }>('/account/wallet')]);
      setWallet(w.balancePaisa);
      setCart(c);
      setAddresses(a);
      if (a[0]) setAddressId((x) => x || a[0].id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.push('/login?next=/cart');
      else setErr(errText(e));
    }
  }, [router]);
  useEffect(() => {
    load();
  }, [load]);

  const setQty = async (id: string, qty: number) => {
    await api(`/cart/${id}`, { method: 'PATCH', json: { qty } }).catch((e) => setErr(errText(e)));
    load();
  };

  if (!cart) return <div className="mx-auto max-w-[1280px] p-6">{err ?? 'লোড হচ্ছে…'}</div>;

  const plans = cart.advancePlans;
  const planObj = plans.find((p) => p.percent === plan) ?? plans[plans.length - 1];
  const lines = cart.groups.flatMap((g) => g.rows.map((r) => ({ unitPaisa: r.unitPaisa, qty: r.qty })));
  const q = quoteCheckout(lines, planObj);

  const saveAddress = async () => {
    setErr(null);
    try {
      const a = await api<Address>('/account/addresses', { method: 'POST', json: newAddr });
      setAddresses((x) => [...x, a]);
      setAddressId(a.id);
    } catch (e) {
      setErr(errText(e));
    }
  };

  const placeOrder = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<Placed>('/checkout', { method: 'POST', json: { advancePercent: plan, couponCode: coupon || undefined, addressId, deliveryMethod: delivery } });
      setPlaced(r);
      setStep(2);
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-[1280px] flex-wrap items-start gap-5 px-3 py-5 md:px-6">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
        {err && <p role="alert" className="rounded-xl bg-[#FDECEA] px-3 py-2 font-semibold text-danger">{err}</p>}

        {step === 0 && (
          <>
            <h1 className="text-2xl font-bold">আমার কার্ট <span className="text-base font-medium text-muted">({toBanglaDigits(q.itemCount)} পিস)</span></h1>
            {!cart.groups.length && <div className="card p-8 text-center">কার্ট খালি। <Link href="/" className="font-bold text-emerald">পণ্য খুঁজুন</Link></div>}
            {cart.groups.map((g) => (
              <section key={g.productId} className="card flex flex-col gap-3 p-4">
                <Link href={`/p/${g.market}/${g.sourceId}`} className="flex gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.image} alt="" className="h-[72px] w-[72px] flex-none rounded-xl bg-ivory-ph object-cover" />
                  <b className="leading-snug">{g.title}</b>
                </Link>
                <div className="overflow-hidden rounded-xl border border-ivory-line">
                  {g.rows.map((r) => (
                    <div key={r.id} className="flex flex-wrap items-center gap-2.5 border-t border-ivory-line px-3 py-2.5 first:border-t-0">
                      <span className="min-w-0 flex-[1_1_160px] text-sm font-semibold">{r.label} · {r.shipMode === 'AIR' ? '✈ Air' : '⚓ Sea'}</span>
                      <span className="text-sm text-muted">{formatBdt(r.unitPaisa)} / পিস</span>
                      <span className="flex items-center rounded-xl border border-ivory-line bg-ivory">
                        <button onClick={() => setQty(r.id, r.qty - 1)} aria-label="কমান" className="h-10 w-10 text-xl">−</button>
                        <span className="min-w-[32px] text-center font-bold">{toBanglaDigits(r.qty)}</span>
                        <button onClick={() => setQty(r.id, r.qty + 1)} aria-label="বাড়ান" className="h-10 w-10 text-xl">+</button>
                      </span>
                      <b className="min-w-[90px] text-right text-emerald">{formatBdt(r.unitPaisa * r.qty)}</b>
                    </div>
                  ))}
                </div>
              </section>
            ))}
            <p className="rounded-2xl bg-gold-chip px-4 py-3 text-sm text-gold-ink">এখানে শুধু পণ্যের দাম। চায়না লোকাল কুরিয়ার, ফ্রেইট (আসল ওজন অনুযায়ী) আর BD কুরিয়ার পরে বিলে যোগ হবে।</p>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="text-2xl font-bold">ডেলিভারির ঠিকানা</h1>
            {addresses.length > 0 && (
              <div className="card grid gap-2.5 p-4 sm:grid-cols-2" role="radiogroup">
                {addresses.map((a) => (
                  <button key={a.id} role="radio" aria-checked={addressId === a.id} onClick={() => setAddressId(a.id)} className={`flex flex-col items-start rounded-2xl border-2 p-3 text-left ${addressId === a.id ? 'border-emerald bg-emerald-light' : 'border-ivory-line'}`}>
                    <b>{a.label} · {a.name}</b><span className="text-sm text-muted">{a.phone}</span><span className="text-sm">{a.line}, {a.area}, {a.district}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="card flex flex-col gap-3 p-4">
              <b>নতুন ঠিকানা</b>
              <div className="grid gap-3 sm:grid-cols-2">
                {(['name', 'phone', 'district', 'area'] as const).map((k) => (
                  <label key={k} className="label">{{ name: 'নাম', phone: 'মোবাইল', district: 'জেলা', area: 'থানা / এলাকা' }[k]}<input className="input" value={newAddr[k]} onChange={(e) => setNewAddr({ ...newAddr, [k]: e.target.value })} /></label>
                ))}
              </div>
              <label className="label">পূর্ণ ঠিকানা<input className="input" value={newAddr.line} onChange={(e) => setNewAddr({ ...newAddr, line: e.target.value })} /></label>
              <button onClick={saveAddress} className="btn-outline self-start">ঠিকানা সেভ করুন</button>
            </div>
            <div className="card grid gap-2.5 p-4 sm:grid-cols-2" role="radiogroup" aria-label="ডেলিভারি পদ্ধতি">
              {DELIVERY.map(([k, label]) => (
                <button key={k} role="radio" aria-checked={delivery === k} onClick={() => setDelivery(k)} className={`min-h-[56px] rounded-2xl border-2 px-3 text-left font-semibold ${delivery === k ? 'border-emerald bg-emerald-light' : 'border-ivory-line'}`}>{label}</button>
              ))}
            </div>
          </>
        )}

        {step === 2 && placed && (
          <section className="card flex flex-col gap-3 p-5">
            <h1 className="text-2xl font-bold">পেমেন্ট</h1>
            <p>অর্ডার: {placed.orders.map((o) => <b key={o.code} className="mr-2 rounded-lg bg-gold-chip px-2 text-gold-ink">{o.code}</b>)}</p>
            {placed.orders.map((o) => <PayBox key={o.code} orderCode={o.code} amount={o.payNowPaisa} wallet={wallet} onDone={() => router.push(`/account/orders/${o.code}`)} />)}
            <Link href="/account" className="text-sm underline">পরে পরিশোধ করব — আমার অর্ডারে যান</Link>
          </section>
        )}
      </div>

      {step < 2 && cart.groups.length > 0 && (
        <aside className="card flex min-w-0 flex-[1_1_340px] flex-col gap-3 p-4 md:sticky md:top-4">
          <b className="text-lg">অর্ডার সারাংশ</b>
          <div className="grid grid-cols-3 gap-2" role="radiogroup">
            {plans.map((p) => (
              <button key={p.percent} role="radio" aria-checked={plan === p.percent} onClick={() => setPlan(p.percent)} className={`min-h-[56px] rounded-xl border-2 ${plan === p.percent ? 'border-navy bg-navy text-white' : 'border-ivory-line'}`}>
                <b className="block">{toBanglaDigits(p.percent)}%</b><span className="text-xs">{p.discountPct ? `${toBanglaDigits(p.discountPct)}% ছাড়` : 'ছাড় নেই'}</span>
              </button>
            ))}
          </div>
          <input className="input" placeholder="কুপন কোড" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} aria-label="কুপন কোড" />
          <div className="flex flex-col gap-1.5 border-t border-ivory-line pt-3 text-[15px]">
            <div className="flex justify-between"><span>পণ্যের দাম</span><b>{formatBdt(q.subtotal)}</b></div>
            <div className="flex justify-between text-emerald"><span>অ্যাডভান্স ছাড়</span><span>{formatBdt(-q.advanceDiscount)}</span></div>
            <div className="flex justify-between text-sm text-muted"><span>কুরিয়ার ও ফ্রেইট</span><span>পরে বিলে</span></div>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-gold-chip p-2.5 text-center"><div className="text-xs text-gold-ink">এখন দিন</div><b className="text-xl">{formatBdt(q.payNow)}</b></div>
              <div className="rounded-xl bg-ivory p-2.5 text-center"><div className="text-xs text-muted">পণ্য পৌঁছালে</div><b className="text-xl">{formatBdt(q.payOnArrival)}</b></div>
            </div>
            {coupon && <p className="text-xs text-muted">কুপনের ছাড় অর্ডার দেওয়ার সময় হিসাব হবে।</p>}
          </div>
          {step === 0 ? (
            <button onClick={() => setStep(1)} className="btn-gold min-h-[54px] text-lg">চেকআউট করুন →</button>
          ) : (
            <>
              <button disabled={busy || !addressId} onClick={placeOrder} className="btn-gold min-h-[54px] text-lg">অর্ডার দিন →</button>
              <button onClick={() => setStep(0)} className="font-semibold">← আগের ধাপ</button>
            </>
          )}
        </aside>
      )}
    </div>
  );
}
