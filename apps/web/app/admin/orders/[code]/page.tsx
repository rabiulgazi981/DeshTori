'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { STATUS_LABEL_BN, TRANSITIONS, type OrderStatus } from '@deshtori/shared';
import { api, uploadImage } from '@/lib/api';
import { can, useMe } from '@/components/admin/me';
import { Field, Msg, PageHead, Panel, Pill, Table, TakaInput, dt, tk, useAction, useApi } from '@/components/admin/ui';

interface Item { id: string; title: string; image: string | null; sourceUrl: string; skuLabel: string; qty: number; unitFen: number; unitPaisa: number; actualFen: number | null; purchasedQty: number | null; receivedQty: number | null; qcStatus: string | null }
interface Order {
  id: string; code: string; status: OrderStatus; statusBn: string; shipMode: 'AIR' | 'SEA'; cnyRate: number; marginPct: number; advancePct: number; createdAt: string;
  deliveryMethod: string; note: string | null; finalWeightKg: number | null; couponCode: string | null;
  addressSnapshot: { name?: string; phone?: string; district?: string; area?: string; line?: string };
  user: { id: string; name: string | null; phone: string; customerCode: string | null };
  items: Item[];
  charges: { id: string; code: string; label: string; amount: number; createdAt: string }[];
  payments: { id: string; method: string; amount: number; trxId: string | null; status: string; createdAt: string; screenshot: string | null }[];
  decisions: { id: string; issue: string; proposal: string; diffPaisa: number; answer: string; reminders: number; token: string; createdAt: string }[];
  qcPhotos: { id: string; url: string }[];
  events: { id: string; fromStatus: string | null; toStatus: string | null; note: string | null; createdAt: string; internal: boolean }[];
  shipment: { code: string; status: string } | null;
  bill: { lines: { code: string; label: string; amount: number }[]; total: number; paid: number; due: number };
}

const CHARGE_CODES: [string, string][] = [
  ['CN_LOCAL_COURIER', 'চায়না লোকাল কুরিয়ার'],
  ['PACKAGING', 'প্যাকেজিং'],
  ['FREIGHT', 'শিপিং চার্জ'],
  ['EXTRA_SERVICE', 'অতিরিক্ত সেবা'],
  ['BD_COURIER', 'দেশের ভেতরে কুরিয়ার'],
  ['ADJUSTMENT', 'সমন্বয় (+/−)'],
];

export default function OrderDetail({ params }: { params: { code: string } }) {
  const me = useMe();
  const router = useRouter();
  const { data: o, err, reload } = useApi<Order>(`/admin/orders/${params.code}`);
  const act = useAction();
  const [note, setNote] = useState('');
  const [charge, setCharge] = useState({ code: 'CN_LOCAL_COURIER', label: 'চায়না লোকাল কুরিয়ার', amount: 0 });
  const [weight, setWeight] = useState({ weightKg: '', category: 'A' });
  const [dec, setDec] = useState({ itemId: '', issue: '', proposal: '', diffPaisa: 0 });

  if (err) return <p className="text-danger">{err}</p>;
  if (!o) return <p className="text-muted">লোড হচ্ছে…</p>;

  const post = (path: string, json: unknown, method = 'POST', ok?: string) => act.run(async () => { const r = await api(path, { method, json }); await reload(); return r; }, ok);
  const next = TRANSITIONS[o.status];
  const fenTk = (fen: number) => `¥${(fen / 100).toFixed(2)}`;

  return (
    <>
      <PageHead title={`অর্ডার ${o.code}`}>
        <Pill s={o.status} label={o.statusBn} />
        <span className="chip bg-ivory-ph">{o.shipMode === 'AIR' ? 'Air' : 'Sea'} · অগ্রিম {o.advancePct}%</span>
        <span className="chip bg-gold-chip text-gold-ink">রেট ¥1 = ৳{o.cnyRate} · মার্জিন {o.marginPct}% (শুধু স্টাফ)</span>
      </PageHead>
      <Msg m={act.msg} />
      <div className="mt-3 grid gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <Panel title="পণ্য ও ক্রয়">
            <Table head={['পণ্য', 'ভ্যারিয়েন্ট', 'পরিমাণ', 'সাপ্লায়ার দাম', 'গ্রাহকের দাম', 'আসল ক্রয় দাম (¥ পয়সা)', 'কেনা', 'পৌঁছেছে', 'QC']} min={1000}>
              {o.items.map((i) => (
                <ItemRow key={i.id} i={i} fenTk={fenTk} editable={can(me, ['CN_PURCHASE', 'CN_WAREHOUSE'])} onSave={(d) => post(`/admin/orders/${o.code}/items/${i.id}`, d, 'PATCH')} />
              ))}
            </Table>
          </Panel>

          <Panel title="অবস্থা পরিবর্তন">
            {next.length ? (
              <>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="নতুন অবস্থা">
                  {next.map((s) => (
                    <button key={s} className={s === 'CANCELLED' ? 'btn-outline border-danger text-danger' : 'btn-navy'} disabled={act.busy} onClick={() => post(`/admin/orders/${o.code}/status`, { status: s, note: note || undefined }, 'PATCH', `অবস্থা: ${STATUS_LABEL_BN[s]}`)}>
                      → {STATUS_LABEL_BN[s]}
                    </button>
                  ))}
                </div>
                <Field label="নোট (গ্রাহক দেখবে)"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ঐচ্ছিক" /></Field>
                <p className="text-xs text-muted">পরিবর্তন করলে গ্রাহক SMS পাবেন। আপনার রোলের অনুমতি না থাকলে পরিবর্তন হবে না।</p>
              </>
            ) : <p className="text-muted">এই অবস্থা থেকে আর কোনো ধাপ নেই।</p>}
          </Panel>

          <Panel title="সাপ্লায়ার সমস্যা — গ্রাহকের সিদ্ধান্ত">
            {o.decisions.map((x) => (
              <div key={x.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-ivory-line p-3 text-sm">
                <b>{x.issue}</b> → {x.proposal} {x.diffPaisa !== 0 && <span>({x.diffPaisa > 0 ? '+' : ''}{tk(x.diffPaisa)})</span>}
                <Pill s={x.answer === 'PENDING' ? 'PAYMENT_REVIEW' : x.answer === 'YES' ? 'DELIVERED' : 'CANCELLED'} label={x.answer === 'PENDING' ? 'উত্তরের অপেক্ষা' : x.answer === 'YES' ? 'হ্যাঁ' : 'না'} />
                {x.answer === 'PENDING' && <button className="btn-outline h-9 min-h-0 text-sm" onClick={() => post(`/admin/decisions/${x.id}/remind`, {}, 'POST', 'রিমাইন্ডার পাঠানো হয়েছে')}>আবার SMS ({x.reminders})</button>}
                <a className="text-xs underline" href={`/d/${x.token}`} target="_blank" rel="noreferrer">লিংক</a>
              </div>
            ))}
            {can(me, ['CN_PURCHASE', 'BD_ORDER']) && (
              <div className="grid gap-2 md:grid-cols-2">
                <Field label="কোন পণ্য"><select className="input" value={dec.itemId} onChange={(e) => setDec({ ...dec, itemId: e.target.value })}><option value="">পুরো অর্ডার</option>{o.items.map((i) => <option key={i.id} value={i.id}>{i.title.slice(0, 40)} · {i.skuLabel}</option>)}</select></Field>
                <Field label="সমস্যা"><input className="input" value={dec.issue} onChange={(e) => setDec({ ...dec, issue: e.target.value })} placeholder="যেমন: লাল রং স্টকে নেই" /></Field>
                <Field label="প্রস্তাব"><input className="input" value={dec.proposal} onChange={(e) => setDec({ ...dec, proposal: e.target.value })} placeholder="যেমন: কালো রং দেব?" /></Field>
                <Field label="দামের পার্থক্য (+ বেশি / − কম)"><TakaInput allowNegative value={dec.diffPaisa} onChange={(v) => setDec({ ...dec, diffPaisa: v })} /></Field>
                <button className="btn-gold md:col-span-2" disabled={!dec.issue || !dec.proposal || act.busy} onClick={async () => { await post(`/admin/orders/${o.code}/decisions`, { ...dec, itemId: dec.itemId || undefined }, 'POST', 'গ্রাহককে SMS-এ হ্যাঁ/না লিংক পাঠানো হয়েছে'); setDec({ itemId: '', issue: '', proposal: '', diffPaisa: 0 }); }}>গ্রাহককে জিজ্ঞেস করুন</button>
              </div>
            )}
          </Panel>

          <Panel title="QC ছবি">
            <div className="flex flex-wrap gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {o.qcPhotos.map((p) => <a key={p.id} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt="QC" className="h-24 w-24 rounded-lg object-cover" /></a>)}
              {!o.qcPhotos.length && <span className="text-sm text-muted">কোনো ছবি নেই</span>}
            </div>
            {can(me, ['CN_WAREHOUSE']) && (
              <label className="btn-outline w-fit cursor-pointer">
                ছবি যোগ করুন
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) await act.run(async () => { const url = await uploadImage(f); await api(`/admin/orders/${o.code}/qc-photos`, { method: 'POST', json: { url } }); await reload(); }, 'ছবি যোগ হয়েছে'); }} />
              </label>
            )}
          </Panel>

          <Panel title="টাইমলাইন">
            <ol className="flex flex-col gap-2 text-sm">
              {o.events.map((e) => (
                <li key={e.id} className="flex flex-wrap gap-2 border-l-2 border-gold pl-3">
                  <span className="text-muted">{dt(e.createdAt)}</span>
                  {e.toStatus && <b>{STATUS_LABEL_BN[e.toStatus as OrderStatus]}</b>}
                  {e.note && <span>— {e.note}</span>}
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="গ্রাহক">
            <Link href={`/admin/customers/${o.user.id}`} className="font-bold underline">{o.user.name}</Link>
            <span className="text-sm">{o.user.phone} · শিপিং মার্ক <b>{o.user.customerCode}</b></span>
            <span className="text-sm text-muted">{o.addressSnapshot.name}, {o.addressSnapshot.phone}<br />{o.addressSnapshot.line}, {o.addressSnapshot.area}, {o.addressSnapshot.district}</span>
            <span className="text-sm">ডেলিভারি: {o.deliveryMethod}</span>
            {o.note && <span className="rounded-lg bg-gold-chip p-2 text-sm">গ্রাহকের নোট: {o.note}</span>}
            {o.shipment && <span className="text-sm">শিপমেন্ট: <b>{o.shipment.code}</b></span>}
          </Panel>

          <Panel title="বিল">
            <ul className="flex flex-col gap-1 text-sm">
              {o.bill.lines.map((l, i) => <li key={i} className="flex justify-between gap-2"><span>{l.label}</span><span>{tk(l.amount)}</span></li>)}
              <li className="mt-1 flex justify-between border-t border-ivory-line pt-1 font-bold"><span>মোট</span><span>{tk(o.bill.total)}</span></li>
              <li className="flex justify-between"><span>পরিশোধিত</span><span>{tk(o.bill.paid)}</span></li>
              <li className={`flex justify-between font-bold ${o.bill.due > 0 ? 'text-danger' : 'text-emerald'}`}><span>বাকি</span><span>{tk(o.bill.due)}</span></li>
            </ul>
            {can(me, ['ACCOUNTS', 'BD_DELIVERY', 'BD_ORDER']) && (
              <button className="btn-navy" disabled={act.busy} onClick={async () => { const inv = await act.run(() => api<{ code: string }>('/admin/invoices', { method: 'POST', json: { orderCodes: [o.code], kind: 'DELIVERY' } })); if (inv) router.push(`/invoice/${inv.code}`); }}>🧾 ইনভয়েস তৈরি করুন</button>
            )}
          </Panel>

          {can(me, ['CN_WAREHOUSE', 'SHIPMENT']) && (
            <Panel title="ওজন → শিপিং চার্জ">
              <p className="text-xs text-muted">ওজন দিলে রেট টেবিল থেকে চার্জ নিজে বসবে। আবার দিলে আগেরটা বদলে যাবে।{o.finalWeightKg ? ` বর্তমান: ${o.finalWeightKg} কেজি` : ''}</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="ওজন (কেজি)"><input className="input" inputMode="decimal" value={weight.weightKg} onChange={(e) => setWeight({ ...weight, weightKg: e.target.value })} /></Field>
                <Field label="ক্যাটাগরি"><select className="input" value={weight.category} onChange={(e) => setWeight({ ...weight, category: e.target.value })}>{['A', 'B', 'C'].map((c) => <option key={c}>{c}</option>)}</select></Field>
              </div>
              <button className="btn-gold" disabled={!Number(weight.weightKg) || act.busy} onClick={() => post(`/admin/orders/${o.code}/weight`, { weightKg: Number(weight.weightKg), category: weight.category }, 'POST', 'শিপিং চার্জ বসানো হয়েছে')}>চার্জ বসান</button>
            </Panel>
          )}

          {can(me, ['CN_PURCHASE', 'CN_WAREHOUSE', 'SHIPMENT', 'BD_DELIVERY', 'ACCOUNTS']) && (
            <Panel title="চার্জ যোগ করুন">
              <Field label="ধরন"><select className="input" value={charge.code} onChange={(e) => setCharge({ ...charge, code: e.target.value, label: CHARGE_CODES.find((c) => c[0] === e.target.value)?.[1] ?? '' })}>{CHARGE_CODES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</select></Field>
              <Field label="বিবরণ"><input className="input" value={charge.label} onChange={(e) => setCharge({ ...charge, label: e.target.value })} /></Field>
              <Field label="টাকা"><TakaInput allowNegative={charge.code === 'ADJUSTMENT'} value={charge.amount} onChange={(v) => setCharge({ ...charge, amount: v })} /></Field>
              <button className="btn-gold" disabled={!charge.amount || act.busy} onClick={async () => { await post(`/admin/orders/${o.code}/charges`, charge, 'POST', 'চার্জ যোগ হয়েছে'); setCharge({ ...charge, amount: 0 }); }}>যোগ করুন</button>
            </Panel>
          )}

          <Panel title="পেমেন্ট">
            {o.payments.length ? o.payments.map((p) => (
              <div key={p.id} className="flex flex-wrap justify-between gap-1 text-sm">
                <span>{p.method} {p.trxId && <code className="text-xs">{p.trxId}</code>}</span>
                <span>{tk(p.amount)} <Pill s={p.status === 'VERIFIED' ? 'DELIVERED' : p.status === 'PENDING' ? 'PAYMENT_REVIEW' : 'CANCELLED'} label={p.status} /></span>
              </div>
            )) : <span className="text-sm text-muted">কোনো পেমেন্ট নেই</span>}
          </Panel>
        </div>
      </div>
    </>
  );
}

function ItemRow({ i, fenTk, editable, onSave }: { i: Item; fenTk: (f: number) => string; editable: boolean; onSave: (d: Record<string, unknown>) => void }) {
  const [v, setV] = useState({ actualFen: i.actualFen ?? '', purchasedQty: i.purchasedQty ?? '', receivedQty: i.receivedQty ?? '', qcStatus: i.qcStatus ?? '' });
  const num = (x: string | number) => (x === '' ? undefined : Number(x));
  return (
    <tr>
      <td className="max-w-[260px]">
        <div className="flex gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {i.image && <img src={i.image} alt="" className="h-12 w-12 flex-none rounded-lg object-cover" />}
          <span><span className="line-clamp-2">{i.title}</span><a href={i.sourceUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-navy-400 underline">সাপ্লায়ার লিংক ↗</a></span>
        </div>
      </td>
      <td>{i.skuLabel}</td>
      <td>{i.qty}</td>
      <td>{fenTk(i.unitFen)}</td>
      <td>{tk(i.unitPaisa)}</td>
      <td><input disabled={!editable} className="input w-24 py-1.5" inputMode="numeric" value={v.actualFen} onChange={(e) => setV({ ...v, actualFen: e.target.value })} /></td>
      <td><input disabled={!editable} className="input w-16 py-1.5" inputMode="numeric" value={v.purchasedQty} onChange={(e) => setV({ ...v, purchasedQty: e.target.value })} /></td>
      <td><input disabled={!editable} className="input w-16 py-1.5" inputMode="numeric" value={v.receivedQty} onChange={(e) => setV({ ...v, receivedQty: e.target.value })} /></td>
      <td>
        <div className="flex gap-1">
          <select disabled={!editable} className="input w-24 py-1.5" value={v.qcStatus} onChange={(e) => setV({ ...v, qcStatus: e.target.value })}>
            <option value="">—</option>{['OK', 'DAMAGED', 'SHORT', 'WRONG'].map((s) => <option key={s}>{s}</option>)}
          </select>
          {editable && <button className="btn-outline h-9 min-h-0 px-2 text-xs" onClick={() => onSave({ actualFen: num(v.actualFen), purchasedQty: num(v.purchasedQty), receivedQty: num(v.receivedQty), qcStatus: v.qcStatus || undefined })}>সেভ</button>}
        </div>
      </td>
    </tr>
  );
}
