'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { STATUS_LABEL_BN, type OrderStatus } from '@deshtori/shared';
import { api } from '@/lib/api';
import { can, useMe } from '@/components/admin/me';
import { Field, Msg, PageHead, Panel, Pill, Table, TakaInput, d, dt, tk, useAction, useApi } from '@/components/admin/ui';

interface C {
  id: string; phone: string; email: string | null; name: string | null; customerCode: string | null; buyerType: string | null; walletPaisa: number; isBlocked: boolean; internalNote: string | null; createdAt: string;
  addresses: { id: string; label: string; name: string; phone: string; district: string; area: string; line: string }[];
  orders: { code: string; status: OrderStatus; createdAt: string; payNowPaisa: number; paidPaisa: number }[];
  walletTxns: { id: string; type: string; amount: number; note: string; createdAt: string }[];
  cart: { productId: string; skuLabel: string; qty: number }[];
}

export default function Customer({ params }: { params: { id: string } }) {
  const me = useMe();
  const { data: c, err, reload } = useApi<C>(`/admin/customers/${params.id}`);
  const act = useAction();
  const [note, setNote] = useState('');
  const [adj, setAdj] = useState({ amount: 0, note: '' });
  useEffect(() => setNote(c?.internalNote ?? ''), [c?.internalNote]);
  if (err) return <p className="text-danger">{err}</p>;
  if (!c) return <p className="text-muted">লোড হচ্ছে…</p>;
  const patch = (json: unknown, ok: string) => act.run(async () => { await api(`/admin/customers/${c.id}`, { method: 'PATCH', json }); await reload(); }, ok);
  return (
    <>
      <PageHead title={`${c.name ?? 'গ্রাহক'} · ${c.customerCode}`}>
        {c.isBlocked && <span className="chip bg-[#FBE9E6] text-danger">ব্লকড</span>}
        {can(me, ['BD_ORDER']) && <button className="btn-outline" onClick={() => patch({ isBlocked: !c.isBlocked }, c.isBlocked ? 'আনব্লক হয়েছে' : 'ব্লক হয়েছে, সব সেশন বন্ধ')}>{c.isBlocked ? 'আনব্লক' : 'ব্লক করুন'}</button>}
      </PageHead>
      <Msg m={act.msg} />
      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        <Panel title="তথ্য">
          <span>{c.phone}{c.email ? ` · ${c.email}` : ''}</span>
          <span className="text-sm text-muted">ধরন: {c.buyerType ?? '—'} · যোগদান {d(c.createdAt)}</span>
          {c.addresses.map((a) => <span key={a.id} className="rounded-lg bg-ivory p-2 text-sm"><b>{a.label}</b>: {a.name}, {a.phone}, {a.line}, {a.area}, {a.district}</span>)}
          <Field label="ভেতরের নোট (গ্রাহক দেখবে না)"><textarea className="input min-h-[80px]" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <button className="btn-outline" onClick={() => patch({ internalNote: note }, 'নোট সেভ হয়েছে')}>নোট সেভ</button>
        </Panel>
        <Panel title={`ওয়ালেট: ${tk(c.walletPaisa)}`}>
          {can(me, ['ACCOUNTS']) && (
            <>
              <Field label="টাকা (+ জমা / − কাটা)"><TakaInput allowNegative value={adj.amount} onChange={(v) => setAdj({ ...adj, amount: v })} /></Field>
              <Field label="কারণ"><input className="input" value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} /></Field>
              <button className="btn-gold" disabled={!adj.amount || !adj.note || act.busy} onClick={async () => { await act.run(async () => { await api(`/admin/customers/${c.id}/wallet`, { method: 'POST', json: adj }); await reload(); }); setAdj({ amount: 0, note: '' }); }}>ওয়ালেট আপডেট</button>
            </>
          )}
          <ul className="flex flex-col gap-1 text-sm">
            {c.walletTxns.map((t) => <li key={t.id} className="flex justify-between gap-2"><span>{t.note}<br /><span className="text-xs text-muted">{dt(t.createdAt)}</span></span><b className={t.amount < 0 ? 'text-danger' : 'text-emerald'}>{tk(t.amount)}</b></li>)}
          </ul>
        </Panel>
        <Panel title="কার্টে আছে">
          {c.cart.length ? c.cart.map((x, i) => <span key={i} className="text-sm">{x.skuLabel} × {x.qty}</span>) : <span className="text-sm text-muted">খালি</span>}
        </Panel>
      </div>
      <Panel title="অর্ডার" className="mt-4">
        <Table head={['অর্ডার', 'তারিখ', 'অগ্রিম', 'পরিশোধিত', 'অবস্থা']}>
          {c.orders.map((o) => <tr key={o.code}><td><Link className="font-bold underline" href={`/admin/orders/${o.code}`}>{o.code}</Link></td><td>{d(o.createdAt)}</td><td>{tk(o.payNowPaisa)}</td><td>{tk(o.paidPaisa)}</td><td><Pill s={o.status} label={STATUS_LABEL_BN[o.status]} /></td></tr>)}
        </Table>
      </Panel>
    </>
  );
}
