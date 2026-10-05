'use client';
import { useEffect, useState } from 'react';
import { formatBdt } from '@deshtori/shared';
import { api, errText } from '@/lib/api';
import { useCustomer } from '@/components/useCustomer';

interface Me { user: { name: string | null; customerCode: string | null } }
interface SR { id: string; code: string; warehouse: string; trackingNo: string; cartons: number; totalPieces: number; description: string; status: string; statusBn: string; receivedCartons: number | null; weightKg: number | null; chargePaisa: number | null; createdAt: string }
type WH = { gz?: string; hk?: string; sea?: string };

const WAREHOUSES = [
  { k: 'GZ_AIR', key: 'gz', name: 'গুয়াংজু গুদাম', note: 'Air · ৭–১৫ দিন' },
  { k: 'HK_AIR', key: 'hk', name: 'হংকং গুদাম', note: 'Air · ১৫–২৫ দিন' },
  { k: 'SEA', key: 'sea', name: 'Sea গুদাম', note: 'Sea · ৪৫–৬৫ দিন' },
] as const;
const EXTRA = [['NONE', 'কিছু না'], ['PAYMENT', 'সাপ্লায়ারকে পেমেন্ট'], ['SPECIAL_PACKING', 'স্পেশাল প্যাকিং'], ['INSPECTION', 'পণ্য পরিদর্শন']] as const;

export default function Ship() {
  const me = useCustomer<Me>('/auth/me');
  const list = useCustomer<SR[]>('/ship-requests');
  const [wh, setWh] = useState<WH>({});
  const [copied, setCopied] = useState('');
  const [f, setF] = useState({ warehouse: 'GZ_AIR', trackingNo: '', cartons: '', totalPieces: '', description: '', category: 'A', extraService: 'NONE', agree: false });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api<{ value: WH | null }>('/content/warehouses').then((r) => setWh(r.value ?? {})).catch(() => undefined); }, []);

  const mark = me.data ? `${me.data.user.customerCode ?? ''} ${me.data.user.name ?? ''}`.trim() : '';
  const copy = async (key: 'gz' | 'hk' | 'sea') => {
    const text = `${wh[key] ?? ''}\nShipping Mark: DeshTori ${mark}`;
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 2000); } catch { /* clipboard blocked */ }
  };
  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ code: string }>('/ship-requests', { method: 'POST', json: { warehouse: f.warehouse, trackingNo: f.trackingNo.trim(), cartons: Number(f.cartons), totalPieces: Number(f.totalPieces), description: f.description, category: f.category, extraService: f.extraService } });
      setMsg({ ok: true, text: `জমা হয়েছে! আপনার শিপিং আইডি ${r.code}। পার্সেল গুদামে পৌঁছালে SMS পাবেন।` });
      setF({ ...f, trackingNo: '', cartons: '', totalPieces: '', description: '', agree: false });
      await list.reload();
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    } finally {
      setBusy(false);
    }
  };
  const valid = f.trackingNo.trim().length >= 4 && Number(f.cartons) >= 1 && Number(f.totalPieces) >= 1 && f.description.trim().length >= 2 && f.agree;

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-4 px-3 py-5 md:px-6">
      <div>
        <h1 className="text-2xl font-bold">শুধু শিপিং সার্ভিস</h1>
        <p className="text-muted">চীন থেকে নিজে কিনেছেন? আমাদের গুদামে পাঠান — আমরা বাংলাদেশে পৌঁছে দেব। ওজন মাপার পর বিল হবে।</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="card flex flex-col gap-3 p-4">
          <h2 className="text-lg font-bold">ইমপোর্ট ফর্ম</h2>
          <p className="rounded-xl bg-ivory p-3 text-sm">চীন 🇨🇳 → বাংলাদেশ 🇧🇩 · শিপিং মার্ক: <b>DeshTori {mark}</b></p>
          <fieldset className="grid gap-2 sm:grid-cols-3"><legend className="mb-1 text-sm font-semibold">গুদাম</legend>
            {WAREHOUSES.map((w) => (
              <label key={w.k} className={`flex cursor-pointer flex-col rounded-xl border-2 p-3 ${f.warehouse === w.k ? 'border-gold bg-gold-chip' : 'border-ivory-line'}`}>
                <input type="radio" name="wh" className="sr-only" checked={f.warehouse === w.k} onChange={() => setF({ ...f, warehouse: w.k })} />
                <b>{w.name}</b><span className="text-sm text-muted">{w.note}</span>
              </label>
            ))}
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="label">চায়না ট্র্যাকিং নম্বর<input className="input" value={f.trackingNo} onChange={(e) => setF({ ...f, trackingNo: e.target.value })} placeholder="যেমন SF1234567890" /></label>
            <label className="label">পণ্যের ধরন (ফ্রেইট ক্যাটাগরি)<select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="A">A — সাধারণ পণ্য</option><option value="B">B — ব্যাটারি/কপি/কেমিক্যাল</option><option value="C">C — পোশাক/কসমেটিক্স/ঘড়ি</option></select></label>
            <label className="label">কার্টুনের সংখ্যা<input className="input" inputMode="numeric" value={f.cartons} onChange={(e) => setF({ ...f, cartons: e.target.value.replace(/\D/g, '') })} /></label>
            <label className="label">এই কার্টুনে মোট কত পিস পণ্য<input className="input" inputMode="numeric" value={f.totalPieces} onChange={(e) => setF({ ...f, totalPieces: e.target.value.replace(/\D/g, '') })} /></label>
          </div>
          <label className="label">পণ্যের সংক্ষিপ্ত বিবরণ<textarea className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="যেমন: ছেলেদের টি-শার্ট ১২০ পিস" /></label>
          <fieldset><legend className="mb-1 text-sm font-semibold">অতিরিক্ত সেবা (চার্জ প্রযোজ্য)</legend>
            <div className="flex flex-wrap gap-2">
              {EXTRA.map(([k, l]) => <button type="button" key={k} onClick={() => setF({ ...f, extraService: k })} className={`chip min-h-[40px] border px-3 text-sm ${f.extraService === k ? 'border-navy bg-navy text-white' : 'border-ivory-line'}`}>{l}</button>)}
            </div>
          </fieldset>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5 flex-none" checked={f.agree} onChange={(e) => setF({ ...f, agree: e.target.checked })} />আমি নিশ্চিত করছি এই পার্সেলে কোনো নিষিদ্ধ পণ্য (অস্ত্র, মাদক, দাহ্য পদার্থ ইত্যাদি) নেই।</label>
          {msg && <p role="status" className={`rounded-lg px-3 py-2 text-sm font-semibold ${msg.ok ? 'bg-emerald-light text-emerald-dark' : 'bg-[#FBE9E6] text-danger'}`}>{msg.text}</p>}
          <button className="btn-gold w-fit" disabled={!valid || busy} onClick={submit}>ফর্ম জমা দিন</button>
        </section>
        <aside className="flex flex-col gap-3">
          {WAREHOUSES.map((w) => (
            <button key={w.k} onClick={() => copy(w.key)} className="card flex flex-col gap-1 p-4 text-left">
              <span className="flex items-center justify-between"><b>{w.name}</b><span className="chip bg-gold-chip text-gold-ink">{copied === w.key ? '✓ কপি হয়েছে' : 'কপি'}</span></span>
              <span className="whitespace-pre-line text-sm text-muted">{wh[w.key] || 'ঠিকানার জন্য হটলাইনে কল করুন: 01938-27 38 78'}</span>
              <span className="text-sm">Shipping Mark: <b>DeshTori {mark}</b></span>
            </button>
          ))}
        </aside>
      </div>
      <section className="card flex flex-col gap-2 p-4">
        <h2 className="text-lg font-bold">আমার শিপিং পার্সেল</h2>
        {list.data?.length ? list.data.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-ivory-line pt-2 text-sm first:border-0">
            <span><b>{s.code}</b> · {s.trackingNo} · {s.cartons} কার্টন / {s.totalPieces} পিস<br /><span className="text-muted">{s.description}</span></span>
            <span className="text-right"><span className="chip bg-gold-chip text-gold-ink">{s.statusBn}</span>{s.weightKg ? <span className="block">{s.weightKg} কেজি{s.chargePaisa ? ` · বিল ${formatBdt(s.chargePaisa)}` : ''}</span> : null}{s.receivedCartons != null && s.receivedCartons < s.cartons && <span className="block text-danger">পাওয়া গেছে {s.receivedCartons}/{s.cartons} কার্টন</span>}</span>
          </div>
        )) : <p className="text-muted">এখনো কোনো পার্সেল নেই</p>}
      </section>
    </div>
  );
}
