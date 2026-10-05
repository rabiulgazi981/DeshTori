'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Empty, Field, Msg, PageHead, Panel, Table, TakaInput, d, dt, tk, useAction, useApi } from '@/components/admin/ui';

interface L { entries: { id: string; kind: string; category: string; amount: number; note: string | null; orderId: string | null; correctsId: string | null; createdAt: string }[]; totals: Record<string, number>; netPaisa: number }
interface W { id: string; userId: string; method: string; account: string; amount: number; status: string; trxId: string | null; createdAt: string }
const KIND: Record<string, string> = { INCOME: 'আয়', EXPENSE: 'খরচ', SUPPLIER: 'সাপ্লায়ার পেমেন্ট', REFUND: 'ফেরত', TRANSFER: 'ট্রান্সফার' };

export default function Accounts() {
  const [range, setRange] = useState({ from: '', to: '' });
  const qs = new URLSearchParams({ ...(range.from ? { from: range.from } : {}), ...(range.to ? { to: `${range.to}T23:59:59` } : {}) }).toString();
  const { data, err, reload } = useApi<L>(`/admin/ledger${qs ? `?${qs}` : ''}`);
  const w = useApi<W[]>('/admin/withdrawals');
  const act = useAction();
  const [f, setF] = useState({ kind: 'EXPENSE', category: '', amount: 0, note: '', orderCode: '' });
  const [trx, setTrx] = useState<Record<string, string>>({});

  const add = () => act.run(async () => { await api('/admin/ledger', { method: 'POST', json: { ...f, note: f.note || undefined, orderCode: f.orderCode || undefined } }); setF({ ...f, amount: 0, note: '', orderCode: '' }); await reload(); });
  const pay = (id: string, status: string) => act.run(async () => { await api(`/admin/withdrawals/${id}`, { method: 'PATCH', json: { status, trxId: trx[id] || undefined } }); await Promise.all([w.reload(), reload()]); });
  const csv = () => {
    if (!data) return;
    const rows = [['তারিখ', 'ধরন', 'খাত', 'টাকা', 'নোট'], ...data.entries.map((e) => [e.createdAt, e.kind, e.category, (e.amount / 100).toFixed(2), (e.note ?? '').replace(/,/g, ' ')])];
    const url = URL.createObjectURL(new Blob(['﻿' + rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'deshtori-ledger.csv'; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHead title="হিসাব">
        <input type="date" className="input w-auto" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} aria-label="শুরু" />
        <input type="date" className="input w-auto" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} aria-label="শেষ" />
        <button className="btn-outline" onClick={csv}>CSV ডাউনলোড</button>
      </PageHead>
      <Msg m={act.msg} />
      {data && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-6">
          {Object.entries(KIND).map(([k, v]) => <div key={k} className="card p-3"><span className="text-sm text-muted">{v}</span><b className="block text-lg">{tk(data.totals[k] ?? 0)}</b></div>)}
          <div className="rounded-2xl bg-navy p-3 text-white"><span className="text-sm text-[#C8D3EA]">নিট</span><b className="block text-lg text-gold-light">{tk(data.netPaisa)}</b></div>
        </div>
      )}
      <Panel title="নতুন এন্ট্রি (এন্ট্রি মুছা যায় না — ভুল হলে উল্টো এন্ট্রি দিন)" className="mb-4">
        <div className="grid gap-2 md:grid-cols-6">
          <Field label="ধরন"><select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="খাত"><input className="input" list="cats" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></Field>
          <datalist id="cats">{['OFFICE_RENT', 'SALARY', 'SUPPLIER_1688', 'CN_COURIER', 'FREIGHT_CARRIER', 'BD_COURIER', 'MARKETING', 'SMS', 'OTHER'].map((c) => <option key={c} value={c} />)}</datalist>
          <Field label="টাকা"><TakaInput value={f.amount} onChange={(v) => setF({ ...f, amount: v })} /></Field>
          <Field label="অর্ডার (ঐচ্ছিক)"><input className="input" value={f.orderCode} onChange={(e) => setF({ ...f, orderCode: e.target.value })} /></Field>
          <Field label="নোট"><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
          <button className="btn-gold self-end" disabled={!f.category || !f.amount || act.busy} onClick={add}>যোগ করুন</button>
        </div>
      </Panel>
      <Panel title="ওয়ালেট উত্তোলনের অনুরোধ" className="mb-4">
        {w.data && !w.data.length ? <Empty /> : (
          <Table head={['তারিখ', 'পদ্ধতি', 'অ্যাকাউন্ট', 'টাকা', 'অবস্থা', '']}>
            {w.data?.map((x) => (
              <tr key={x.id}>
                <td>{d(x.createdAt)}</td><td>{x.method}</td><td>{x.account}</td><td className="font-bold">{tk(x.amount)}</td><td>{x.status}{x.trxId ? ` · ${x.trxId}` : ''}</td>
                <td>{x.status === 'PENDING' && <div className="flex flex-wrap gap-1"><input className="input w-32 py-1.5" placeholder="TrxID" value={trx[x.id] ?? ''} onChange={(e) => setTrx({ ...trx, [x.id]: e.target.value })} /><button className="btn-gold h-9 min-h-0 px-3 text-sm" disabled={act.busy} onClick={() => pay(x.id, 'SENT')}>পাঠানো হয়েছে</button><button className="btn-outline h-9 min-h-0 px-3 text-sm" disabled={act.busy} onClick={() => pay(x.id, 'REJECTED')}>বাতিল</button></div>}</td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
      {err && <p className="text-danger">{err}</p>}
      <Table head={['সময়', 'ধরন', 'খাত', 'টাকা', 'নোট']}>
        {data?.entries.map((e) => (
          <tr key={e.id}><td>{dt(e.createdAt)}</td><td>{KIND[e.kind]}</td><td>{e.category}</td><td className={e.kind === 'INCOME' ? 'font-bold text-emerald' : 'font-bold'}>{tk(e.amount)}</td><td>{e.note}{e.correctsId && <span className="text-xs text-muted"> (সংশোধনী)</span>}</td></tr>
        ))}
      </Table>
      <p className="mt-2 text-xs text-muted">অর্ডার অনুযায়ী লাভ দেখতে অর্ডার পেজে সাপ্লায়ার দাম ও চার্জ মিলিয়ে নিন। <Link href="/admin/orders" className="underline">অর্ডার</Link></p>
    </>
  );
}
