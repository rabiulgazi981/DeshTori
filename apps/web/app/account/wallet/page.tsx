'use client';
import Link from 'next/link';
import { useState } from 'react';
import { formatBdt } from '@deshtori/shared';
import { api, errText } from '@/lib/api';
import { useCustomer } from '@/components/useCustomer';

interface W { balancePaisa: number; txns: { id: string; type: string; amount: number; note: string; createdAt: string }[] }
interface Wd { id: string; method: string; account: string; amount: number; status: string; createdAt: string }
const ST: Record<string, string> = { PENDING: 'প্রক্রিয়াধীন', SENT: 'পাঠানো হয়েছে', REJECTED: 'বাতিল (টাকা ফেরত)' };

export default function Wallet() {
  const w = useCustomer<W>('/account/wallet');
  const wd = useCustomer<Wd[]>('/account/withdrawals');
  const [f, setF] = useState({ method: 'BKASH', account: '', taka: '' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = async () => {
    try {
      await api('/account/withdrawals', { method: 'POST', json: { method: f.method, account: f.account, amount: Math.round(Number(f.taka) * 100) } });
      setMsg({ ok: true, text: 'অনুরোধ জমা হয়েছে। ১–২ কর্মদিবসে টাকা পাঠানো হবে।' });
      setF({ ...f, taka: '' });
      await Promise.all([w.reload(), wd.reload()]);
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    }
  };
  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4 px-3 py-5 md:px-6">
      <Link href="/account" className="text-sm underline">← অ্যাকাউন্ট</Link>
      <div className="rounded-2xl bg-navy p-5 text-white"><span className="text-sm text-[#C8D3EA]">ওয়ালেট ব্যালেন্স</span><b className="block text-4xl text-gold-light">{formatBdt(w.data?.balancePaisa ?? 0)}</b><p className="mt-1 text-sm text-[#C8D3EA]">রিফান্ড ও ফেরতের টাকা এখানে জমা হয়। পরের অর্ডারে ব্যবহার করুন বা তুলে নিন।</p></div>
      <section className="card flex flex-col gap-2 p-4">
        <h2 className="text-lg font-bold">টাকা তুলুন</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="label">মাধ্যম<select className="input" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}><option value="BKASH">bKash</option><option value="NAGAD">Nagad</option><option value="BANK">ব্যাংক</option></select></label>
          <label className="label">{f.method === 'BANK' ? 'ব্যাংক, শাখা, অ্যাকাউন্ট নম্বর' : 'নম্বর'}<input className="input" value={f.account} onChange={(e) => setF({ ...f, account: e.target.value })} /></label>
          <label className="label">টাকা (ন্যূনতম ৳১০০)<input className="input" inputMode="decimal" value={f.taka} onChange={(e) => setF({ ...f, taka: e.target.value })} /></label>
        </div>
        {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-emerald-light text-emerald-dark' : 'bg-[#FBE9E6] text-danger'}`}>{msg.text}</p>}
        <button className="btn-gold w-fit" disabled={!f.account || Number(f.taka) < 100} onClick={submit}>অনুরোধ পাঠান</button>
        {!!wd.data?.length && <ul className="flex flex-col gap-1 text-sm">{wd.data.map((x) => <li key={x.id} className="flex justify-between"><span>{new Date(x.createdAt).toLocaleDateString('bn-BD')} · {x.method} {x.account}</span><span>{formatBdt(x.amount)} · {ST[x.status]}</span></li>)}</ul>}
      </section>
      <section className="card flex flex-col gap-2 p-4">
        <h2 className="text-lg font-bold">লেনদেন</h2>
        {w.data?.txns.length ? w.data.txns.map((t) => (
          <div key={t.id} className="flex justify-between gap-2 border-t border-ivory-line pt-2 text-sm first:border-0"><span>{t.note}<br /><span className="text-xs text-muted">{new Date(t.createdAt).toLocaleString('bn-BD')}</span></span><b className={t.amount < 0 ? 'text-danger' : 'text-emerald'}>{formatBdt(t.amount)}</b></div>
        )) : <p className="text-muted">কোনো লেনদেন নেই</p>}
      </section>
    </div>
  );
}
