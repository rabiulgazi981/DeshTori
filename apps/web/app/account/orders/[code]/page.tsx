'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatBdt, ORDER_STATUSES, STATUS_LABEL_BN, type OrderStatus } from '@deshtori/shared';
import { api, ApiError, errText, uploadImage } from '@/lib/api';
import { PayBox } from '@/components/PayBox';

interface Order {
  code: string; status: OrderStatus; shipMode: 'AIR' | 'SEA'; advancePct: number; createdAt: string; deliveryMethod: string;
  addressSnapshot: { name?: string; phone?: string; district?: string; area?: string; line?: string };
  items: { id: string; title: string; image: string | null; skuLabel: string; qty: number; unitPaisa: number; receivedQty: number | null }[];
  events: { id: string; toStatus: OrderStatus | null; note: string | null; createdAt: string }[];
  qcPhotos: { id: string; url: string }[];
  decisions: { id: string; issue: string; proposal: string; diffPaisa: number; answer: string; token: string }[];
  bill: { lines: { label: string; amount: number }[]; total: number; paid: number; due: number };
}
const FLOW: OrderStatus[] = ORDER_STATUSES.filter((s) => s !== 'CANCELLED' && s !== 'NEEDS_DECISION' && s !== 'PAYMENT_REVIEW');

export default function OrderPage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const [o, setO] = useState<Order | null>(null);
  const [wallet, setWallet] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [ord, w] = await Promise.all([api<Order>(`/orders/${params.code}`), api<{ balancePaisa: number }>('/account/wallet')]);
      setO(ord);
      setWallet(w.balancePaisa);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.push(`/login?next=/account/orders/${params.code}`);
      else setErr(errText(e));
    }
  }, [params.code, router]);
  useEffect(() => { void load(); }, [load]);

  if (!o) return <div className="mx-auto max-w-[1100px] p-6">{err ?? 'লোড হচ্ছে…'}</div>;
  const stepIdx = FLOW.indexOf(o.status === 'PAYMENT_REVIEW' ? 'PENDING_PAYMENT' : o.status === 'NEEDS_DECISION' ? 'PURCHASING' : o.status);
  const pending = o.decisions.filter((d) => d.answer === 'PENDING');

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-3 py-5 md:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/account" className="text-sm underline">← আমার অর্ডার</Link>
        <h1 className="text-2xl font-bold">অর্ডার {o.code}</h1>
        <span className="chip bg-gold-chip text-gold-ink">{STATUS_LABEL_BN[o.status]}</span>
        <span className="chip bg-ivory-ph">{o.shipMode === 'AIR' ? 'Air ৭–১৫ দিন' : 'Sea ৪৫–৬৫ দিন'}</span>
      </div>

      {pending.map((d) => (
        <Link key={d.id} href={`/d/${d.token}`} className="rounded-2xl border-2 border-danger bg-[#FBE9E6] p-4 font-semibold text-danger">⚠️ আপনার সিদ্ধান্ত দরকার: {d.issue} — এখানে চাপ দিয়ে হ্যাঁ/না জানান</Link>
      ))}

      {o.status !== 'CANCELLED' && (
        <ol className="card flex gap-1 overflow-x-auto p-4" aria-label="অর্ডারের ধাপ">
          {FLOW.map((s, i) => (
            <li key={s} className="flex min-w-[92px] flex-1 flex-col items-center gap-1 text-center text-xs">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${i <= stepIdx ? 'bg-emerald text-white' : 'bg-ivory-ph text-muted'}`} aria-current={i === stepIdx ? 'step' : undefined}>{i < stepIdx ? '✓' : i + 1}</span>
              <span className={i === stepIdx ? 'font-bold' : 'text-muted'}>{STATUS_LABEL_BN[s]}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card flex flex-col gap-3 p-4 lg:col-span-2">
          <h2 className="text-lg font-bold">পণ্য</h2>
          {o.items.map((i) => (
            <div key={i.id} className="flex gap-3 border-t border-ivory-line pt-3 first:border-0 first:pt-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {i.image && <img src={i.image} alt="" className="h-16 w-16 flex-none rounded-xl object-cover" />}
              <div className="min-w-0 flex-1 text-sm">
                <p className="line-clamp-2 font-semibold">{i.title}</p>
                <p className="text-muted">{i.skuLabel} · {i.qty} পিস × {formatBdt(i.unitPaisa)}</p>
                {i.receivedQty != null && i.receivedQty < i.qty && <p className="text-danger">গুদামে পাওয়া গেছে {i.receivedQty} পিস</p>}
              </div>
              <b className="text-sm">{formatBdt(i.unitPaisa * i.qty)}</b>
            </div>
          ))}
          {o.qcPhotos.length > 0 && (
            <>
              <h3 className="font-bold">গুদামের ছবি (QC)</h3>
              <div className="flex flex-wrap gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {o.qcPhotos.map((p) => <a key={p.id} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt="QC ছবি" className="h-24 w-24 rounded-lg object-cover" /></a>)}
              </div>
            </>
          )}
          <h3 className="font-bold">আপডেট</h3>
          <ol className="flex flex-col gap-2 text-sm">
            {o.events.map((e) => (
              <li key={e.id} className="border-l-2 border-gold pl-3"><span className="text-muted">{new Date(e.createdAt).toLocaleString('bn-BD')}</span> {e.toStatus && <b>{STATUS_LABEL_BN[e.toStatus]}</b>} {e.note && <span>— {e.note}</span>}</li>
            ))}
          </ol>
        </section>

        <div className="flex flex-col gap-4">
          <section className="card flex flex-col gap-2 p-4">
            <h2 className="text-lg font-bold">বিল</h2>
            <ul className="flex flex-col gap-1 text-sm">
              {o.bill.lines.map((l, i) => <li key={i} className="flex justify-between gap-2"><span>{l.label}</span><span>{formatBdt(l.amount)}</span></li>)}
              <li className="mt-1 flex justify-between border-t border-ivory-line pt-1 font-bold"><span>মোট</span><span>{formatBdt(o.bill.total)}</span></li>
              <li className="flex justify-between"><span>পরিশোধিত</span><span>{formatBdt(o.bill.paid)}</span></li>
              <li className={`flex justify-between text-base font-bold ${o.bill.due > 0 ? 'text-danger' : 'text-emerald'}`}><span>বাকি</span><span>{formatBdt(o.bill.due)}</span></li>
            </ul>
          </section>
          {o.bill.due > 0 && o.status !== 'CANCELLED' && o.status !== 'PAYMENT_REVIEW' && <PayBox orderCode={o.code} amount={o.bill.due} wallet={wallet} onDone={load} />}
          {o.status === 'PAYMENT_REVIEW' && <p className="rounded-2xl bg-gold-chip p-3 text-sm text-gold-ink">আপনার পেমেন্ট যাচাই করা হচ্ছে। সাধারণত কয়েক ঘণ্টার মধ্যে হয়ে যায়।</p>}
          <section className="card flex flex-col gap-1 p-4 text-sm">
            <h2 className="text-lg font-bold">ডেলিভারি ঠিকানা</h2>
            <span>{o.addressSnapshot.name}, {o.addressSnapshot.phone}</span>
            <span className="text-muted">{o.addressSnapshot.line}, {o.addressSnapshot.area}, {o.addressSnapshot.district}</span>
          </section>
          {(o.status === 'ARRIVED_BD' || o.status === 'DELIVERED') && <Complaint order={o} />}
        </div>
      </div>
    </div>
  );
}

function Complaint({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ itemId: order.items[0]?.id ?? '', kind: 'DAMAGED', qty: 1, wants: 'REFUND', details: '', media: [] as string[] });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!open) return <button className="btn-outline" onClick={() => setOpen(true)}>পণ্যে সমস্যা? অভিযোগ করুন</button>;
  const submit = async () => {
    setBusy(true);
    try {
      await api('/complaints', { method: 'POST', json: { orderCode: order.code, ...f } });
      setMsg({ ok: true, text: 'অভিযোগ জমা হয়েছে। আমরা দ্রুত জানাব।' });
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card flex flex-col gap-2 p-4">
      <h2 className="text-lg font-bold">অভিযোগ</h2>
      <label className="label">পণ্য<select className="input" value={f.itemId} onChange={(e) => setF({ ...f, itemId: e.target.value })}>{order.items.map((i) => <option key={i.id} value={i.id}>{i.title.slice(0, 40)} · {i.skuLabel}</option>)}</select></label>
      <label className="label">সমস্যা<select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="DAMAGED">ভাঙা/নষ্ট</option><option value="SHORT">কম এসেছে</option><option value="WRONG_VARIANT">ভুল রং/সাইজ</option><option value="WRONG_ITEM">ভুল পণ্য</option><option value="OTHER">অন্যান্য</option></select></label>
      <label className="label">কত পিস<input className="input" inputMode="numeric" value={f.qty} onChange={(e) => setF({ ...f, qty: Math.max(1, Number(e.target.value) || 1) })} /></label>
      <label className="label">কী চান<select className="input" value={f.wants} onChange={(e) => setF({ ...f, wants: e.target.value })}><option value="REFUND">টাকা ফেরত (ওয়ালেটে)</option><option value="REPLACE">বদলে দিন</option><option value="PARTIAL">আংশিক ফেরত</option></select></label>
      <label className="label">বিস্তারিত<textarea className="input" value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} /></label>
      <label className="label">ছবি (আনবক্সিং ভিডিও/ছবি থাকলে ভালো)<input type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { const url = await uploadImage(file); setF((x) => ({ ...x, media: [...x.media, url] })); } catch (er) { setMsg({ ok: false, text: errText(er) }); } }} /></label>
      {f.media.length > 0 && <span className="text-xs text-emerald">{f.media.length}টি ছবি যুক্ত</span>}
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-emerald-light text-emerald-dark' : 'bg-[#FBE9E6] text-danger'}`}>{msg.text}</p>}
      {!msg?.ok && <button className="btn-gold" disabled={busy || f.details.length < 3} onClick={submit}>জমা দিন</button>}
    </section>
  );
}
