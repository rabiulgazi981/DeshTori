'use client';
import { useEffect, useState } from 'react';
import { formatBdt } from '@deshtori/shared';
import { api, errText } from '@/lib/api';

interface D { orderCode: string; issue: string; proposal: string; diffPaisa: number; answer: 'PENDING' | 'YES' | 'NO'; item?: { title: string; image: string | null; skuLabel: string; qty: number } }

/** Yes/No link from SMS/WhatsApp – works without logging in. */
export default function Decision({ params }: { params: { token: string } }) {
  const [d, setD] = useState<D | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api<D>(`/decisions/${params.token}`).then(setD).catch((e) => setErr(errText(e))); }, [params.token]);
  const answer = async (a: 'YES' | 'NO') => {
    setBusy(true);
    try { await api(`/decisions/${params.token}`, { method: 'POST', json: { answer: a } }); setD((x) => (x ? { ...x, answer: a } : x)); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  if (!d) return <div className="mx-auto max-w-md p-8 text-center">{err ?? 'লোড হচ্ছে…'}</div>;
  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div className="card flex flex-col gap-3 p-5">
        <span className="chip w-fit bg-gold-chip text-gold-ink">অর্ডার {d.orderCode}</span>
        <h1 className="text-xl font-bold">আপনার সিদ্ধান্ত দরকার</h1>
        {d.item && (
          <div className="flex gap-3 rounded-xl bg-ivory p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {d.item.image && <img src={d.item.image} alt="" className="h-16 w-16 rounded-lg object-cover" />}
            <div className="text-sm"><p className="line-clamp-2 font-semibold">{d.item.title}</p><p className="text-muted">{d.item.skuLabel} · {d.item.qty} পিস</p></div>
          </div>
        )}
        <p><b>সমস্যা:</b> {d.issue}</p>
        <p><b>আমাদের প্রস্তাব:</b> {d.proposal}</p>
        {d.diffPaisa !== 0 && <p className={d.diffPaisa > 0 ? 'text-danger' : 'text-emerald'}>{d.diffPaisa > 0 ? `হ্যাঁ বললে ${formatBdt(d.diffPaisa)} বেশি লাগবে` : `হ্যাঁ বললে ${formatBdt(-d.diffPaisa)} কম লাগবে`}</p>}
        {d.answer === 'PENDING' ? (
          <div className="grid grid-cols-2 gap-3">
            <button className="btn-gold text-lg" disabled={busy} onClick={() => answer('YES')}>✓ হ্যাঁ</button>
            <button className="btn-outline text-lg" disabled={busy} onClick={() => answer('NO')}>✕ না</button>
          </div>
        ) : (
          <p className="rounded-xl bg-emerald-light p-3 font-semibold text-emerald-dark">ধন্যবাদ! আপনার উত্তর: {d.answer === 'YES' ? 'হ্যাঁ' : 'না'}। আমরা সেই অনুযায়ী কাজ করছি।</p>
        )}
        {err && <p className="text-danger">{err}</p>}
        <p className="text-xs text-muted">প্রশ্ন থাকলে কল করুন: 01938-27 38 78</p>
      </div>
    </div>
  );
}
