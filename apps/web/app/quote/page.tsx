'use client';
import { useState } from 'react';
import { api, ApiError, errText } from '@/lib/api';
import { useRouter } from 'next/navigation';

/** Product from another site / bulk sourcing → becomes a support ticket for the team. */
export default function Quote() {
  const router = useRouter();
  const [f, setF] = useState({ link: '', name: '', qty: '', note: '' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = async () => {
    try {
      const t = await api<{ code: string }>('/tickets', { method: 'POST', json: { subject: `কোটেশন: ${f.name || f.link}`.slice(0, 120), text: `লিংক: ${f.link}\nপণ্য: ${f.name}\nপরিমাণ: ${f.qty}\nনোট: ${f.note}` } });
      setMsg({ ok: true, text: `অনুরোধ জমা হয়েছে (${t.code})। ২৪ ঘণ্টার মধ্যে দাম জানানো হবে।` });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.push('/login?next=/quote');
      else setMsg({ ok: false, text: errText(e) });
    }
  };
  return (
    <div className="mx-auto max-w-xl px-3 py-6">
      <section className="card flex flex-col gap-3 p-5">
        <h1 className="text-2xl font-bold">কোটেশন চান</h1>
        <p className="text-muted">অন্য সাইটের পণ্য, পাইকারি বা কাস্টম পণ্য? বিস্তারিত দিন — আমাদের চায়না টিম দাম খুঁজে জানাবে।</p>
        <label className="label">পণ্যের লিংক (থাকলে)<input className="input" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} /></label>
        <label className="label">পণ্যের নাম/বিবরণ<input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="label">পরিমাণ<input className="input" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></label>
        <label className="label">অতিরিক্ত নোট<textarea className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
        {msg && <p className={`rounded-lg px-3 py-2 text-sm font-semibold ${msg.ok ? 'bg-emerald-light text-emerald-dark' : 'bg-[#FBE9E6] text-danger'}`}>{msg.text}</p>}
        <button className="btn-gold w-fit" disabled={!f.link && !f.name} onClick={submit}>জমা দিন</button>
      </section>
    </div>
  );
}
