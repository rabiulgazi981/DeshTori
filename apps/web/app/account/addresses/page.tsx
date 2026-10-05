'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api, errText } from '@/lib/api';
import { useCustomer } from '@/components/useCustomer';

interface A { id: string; label: string; name: string; phone: string; district: string; area: string; line: string; isDefault: boolean }
const blank = { label: 'বাসা', name: '', phone: '', district: 'ঢাকা', area: '', line: '', isDefault: false };

export default function Addresses() {
  const { data, reload } = useCustomer<A[]>('/account/addresses');
  const [f, setF] = useState(blank);
  const [err, setErr] = useState<string | null>(null);
  const add = async () => {
    try { await api('/account/addresses', { method: 'POST', json: f }); setF(blank); setErr(null); await reload(); } catch (e) { setErr(errText(e)); }
  };
  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4 px-3 py-5 md:px-6">
      <Link href="/account" className="text-sm underline">← অ্যাকাউন্ট</Link>
      <h1 className="text-2xl font-bold">ঠিকানা</h1>
      {data?.map((a) => (
        <div key={a.id} className="card flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
          <span><b>{a.label}</b>{a.isDefault && <span className="chip ml-2 bg-emerald-light text-emerald-dark">ডিফল্ট</span>}<br />{a.name}, {a.phone}<br /><span className="text-muted">{a.line}, {a.area}, {a.district}</span></span>
          <button className="btn-outline h-9 min-h-0 px-3 text-sm" onClick={async () => { await api(`/account/addresses/${a.id}`, { method: 'DELETE' }); await reload(); }}>মুছুন</button>
        </div>
      ))}
      <section className="card grid gap-2 p-4 sm:grid-cols-2">
        <h2 className="text-lg font-bold sm:col-span-2">নতুন ঠিকানা</h2>
        {([['label', 'নাম (বাসা/দোকান)'], ['name', 'প্রাপকের নাম'], ['phone', 'মোবাইল'], ['district', 'জেলা'], ['area', 'থানা/এলাকা'], ['line', 'বাড়ি, রাস্তা']] as const).map(([k, l]) => (
          <label key={k} className="label">{l}<input className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
        ))}
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5" checked={f.isDefault} onChange={(e) => setF({ ...f, isDefault: e.target.checked })} />ডিফল্ট ঠিকানা</label>
        {err && <p className="text-sm text-danger sm:col-span-2">{err}</p>}
        <button className="btn-gold w-fit" disabled={!f.name || !f.phone || !f.area || !f.line} onClick={add}>সেভ</button>
      </section>
    </div>
  );
}
