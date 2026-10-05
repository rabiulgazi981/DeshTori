'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api, errText } from '@/lib/api';
import { useCustomer } from '@/components/useCustomer';

interface T { id: string; code: string; subject: string; status: string; messages: { from: 'customer' | 'staff'; text: string; at: string }[]; updatedAt: string }
const ST: Record<string, string> = { OPEN: 'খোলা', ANSWERED: 'উত্তর দেওয়া হয়েছে', CLOSED: 'বন্ধ' };

export default function Support() {
  const { data, reload } = useCustomer<T[]>('/tickets');
  const [f, setF] = useState({ subject: '', text: '' });
  const [reply, setReply] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const open = async () => {
    try { await api('/tickets', { method: 'POST', json: f }); setF({ subject: '', text: '' }); setErr(null); await reload(); } catch (e) { setErr(errText(e)); }
  };
  const send = async (code: string) => {
    try { await api(`/tickets/${code}/reply`, { method: 'POST', json: { text: reply[code] } }); setReply({ ...reply, [code]: '' }); await reload(); } catch (e) { setErr(errText(e)); }
  };
  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4 px-3 py-5 md:px-6">
      <Link href="/account" className="text-sm underline">← অ্যাকাউন্ট</Link>
      <h1 className="text-2xl font-bold">সাপোর্ট</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        <a href="tel:+8801938273878" className="card flex items-center gap-3 p-4"><span className="text-2xl">📞</span><span><b>হটলাইন</b><br />01938-27 38 78</span></a>
        <a href="https://wa.me/8801938273878" target="_blank" rel="noreferrer" className="card flex items-center gap-3 p-4"><span className="text-2xl">💬</span><span><b>WhatsApp</b><br />চ্যাট করুন</span></a>
      </div>
      <section className="card flex flex-col gap-2 p-4">
        <h2 className="text-lg font-bold">নতুন টিকেট</h2>
        <label className="label">বিষয়<input className="input" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="যেমন: অর্ডার DT-10004 কবে আসবে?" /></label>
        <label className="label">বিস্তারিত<textarea className="input min-h-[100px]" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} /></label>
        {err && <p className="text-sm text-danger">{err}</p>}
        <button className="btn-gold w-fit" disabled={f.subject.length < 3 || f.text.length < 3} onClick={open}>পাঠান</button>
      </section>
      {data?.map((t) => (
        <section key={t.id} className="card flex flex-col gap-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><b>{t.code} · {t.subject}</b><span className="chip bg-gold-chip text-gold-ink">{ST[t.status]}</span></div>
          {t.messages.map((m, i) => <p key={i} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.from === 'staff' ? 'bg-navy text-white' : 'self-end bg-ivory'}`}>{m.from === 'staff' && <b className="block text-gold-light">DeshTori</b>}{m.text}<span className="block text-[11px] opacity-70">{new Date(m.at).toLocaleString('bn-BD')}</span></p>)}
          {t.status !== 'CLOSED' && (
            <div className="flex gap-2"><input className="input min-w-0 flex-1" value={reply[t.code] ?? ''} onChange={(e) => setReply({ ...reply, [t.code]: e.target.value })} placeholder="উত্তর লিখুন" /><button className="btn-navy" disabled={!reply[t.code]} onClick={() => send(t.code)}>পাঠান</button></div>
          )}
        </section>
      ))}
    </div>
  );
}
