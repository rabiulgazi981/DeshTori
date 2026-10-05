'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, errText } from '@/lib/api';
import { useCustomer } from '@/components/useCustomer';

interface Me { user: { name: string | null; email: string | null; phone: string; customerCode: string | null; notifyPrefs?: Record<string, boolean> | null } }

export default function Profile() {
  const { data } = useCustomer<Me>('/auth/me');
  const [f, setF] = useState({ name: '', email: '', sms: true, whatsapp: true, email_: false });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    if (!data) return;
    const p = data.user.notifyPrefs ?? {};
    setF({ name: data.user.name ?? '', email: data.user.email ?? '', sms: p.sms !== false, whatsapp: p.whatsapp !== false, email_: !!p.email });
  }, [data]);
  const save = async () => {
    try {
      await api('/account/profile', { method: 'POST', json: { name: f.name || undefined, email: f.email || undefined, notifyPrefs: { sms: f.sms, whatsapp: f.whatsapp, email: f.email_ } } });
      setMsg({ ok: true, text: 'সেভ হয়েছে' });
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    }
  };
  return (
    <div className="mx-auto flex max-w-[700px] flex-col gap-4 px-3 py-5 md:px-6">
      <Link href="/account" className="text-sm underline">← অ্যাকাউন্ট</Link>
      <h1 className="text-2xl font-bold">প্রোফাইল</h1>
      <section className="card flex flex-col gap-3 p-4">
        <p className="text-sm">মোবাইল: <b>{data?.user.phone}</b> · শিপিং মার্ক: <b>{data?.user.customerCode}</b></p>
        <label className="label">নাম<input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="label">ইমেইল (ঐচ্ছিক)<input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <fieldset className="flex flex-col gap-2"><legend className="mb-1 text-sm font-semibold">অর্ডারের আপডেট কোথায় পাবেন</legend>
          <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={f.sms} onChange={(e) => setF({ ...f, sms: e.target.checked })} />SMS</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.checked })} />WhatsApp</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={f.email_} onChange={(e) => setF({ ...f, email_: e.target.checked })} />ইমেইল</label>
        </fieldset>
        {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-emerald-light text-emerald-dark' : 'bg-[#FBE9E6] text-danger'}`}>{msg.text}</p>}
        <button className="btn-gold w-fit" onClick={save}>সেভ</button>
        <Link href="/login?reset=1" className="text-sm underline">পাসওয়ার্ড পরিবর্তন করুন (OTP লাগবে)</Link>
      </section>
    </div>
  );
}
