'use client';
import { useEffect, useState } from 'react';
import { api, uploadImage } from '@/lib/api';
import { Field, Msg, PageHead, Panel, useAction } from '@/components/admin/ui';

type F = { k: string; label: string; type?: 'text' | 'textarea' | 'bool' | 'image' | 'date' | 'number'; hint?: string };
type Schema = { label: string; list: boolean; fields: F[]; help?: string };

/** Every editable block of the public website. Keys match the API's CONTENT_KEYS. */
const SCHEMAS: Record<string, Schema> = {
  banners: { label: 'হোম ব্যানার', list: true, fields: [{ k: 'image', label: 'ছবি', type: 'image' }, { k: 'title', label: 'শিরোনাম' }, { k: 'link', label: 'লিংক' }] },
  videos: { label: 'ভিডিও (YouTube / Facebook)', list: true, help: 'YouTube বা Facebook ভিডিওর লিংক দিন — ওয়েবসাইটে থাম্বনেইল দেখাবে, ক্লিক করলে সাইটের ভেতরেই চলবে।', fields: [{ k: 'title', label: 'শিরোনাম' }, { k: 'url', label: 'ভিডিও লিংক' }, { k: 'thumb', label: 'থাম্বনেইল (Facebook-এর জন্য)', type: 'image' }] },
  categories: { label: 'হোম ক্যাটাগরি', list: true, fields: [{ k: 'name', label: 'বাংলা নাম' }, { k: 'query', label: 'সার্চ শব্দ (ইংরেজি)' }, { k: 'image', label: 'ছবি', type: 'image' }] },
  services: { label: 'সেবাসমূহ', list: true, fields: [{ k: 'icon', label: 'আইকন (ইমোজি)' }, { k: 'title', label: 'নাম' }, { k: 'text', label: 'বিবরণ', type: 'textarea' }] },
  popup: { label: 'পপআপ', list: false, fields: [{ k: 'on', label: 'চালু', type: 'bool' }, { k: 'title', label: 'শিরোনাম' }, { k: 'text', label: 'লেখা', type: 'textarea' }, { k: 'image', label: 'ছবি', type: 'image' }, { k: 'link', label: 'বাটনের লিংক' }, { k: 'button', label: 'বাটনের লেখা' }] },
  campaign: { label: 'ক্যাম্পেইন', list: false, fields: [{ k: 'on', label: 'চালু', type: 'bool' }, { k: 'title', label: 'শিরোনাম' }, { k: 'text', label: 'বিবরণ', type: 'textarea' }, { k: 'couponCode', label: 'কুপন কোড' }, { k: 'endsAt', label: 'শেষ তারিখ', type: 'date' }] },
  contact: { label: 'যোগাযোগ ও ম্যানুয়াল পেমেন্ট', list: false, fields: [{ k: 'hotline', label: 'হটলাইন' }, { k: 'whatsapp', label: 'WhatsApp নম্বর' }, { k: 'email', label: 'ইমেইল' }, { k: 'address', label: 'ঠিকানা', type: 'textarea' }, { k: 'facebook', label: 'Facebook পেজ লিংক' }, { k: 'youtube', label: 'YouTube চ্যানেল' }, { k: 'bkash', label: 'bKash মার্চেন্ট/পার্সোনাল নম্বর' }, { k: 'nagad', label: 'Nagad নম্বর' }, { k: 'bank', label: 'ব্যাংক তথ্য', type: 'textarea' }] },
  warehouses: { label: 'চায়না গুদামের ঠিকানা', list: false, help: 'শিপিং পেজে দেখাবে। গ্রাহক ক্লিক করলে তার শিপিং মার্কসহ পুরো ঠিকানা কপি হবে।', fields: [{ k: 'gz', label: 'গুয়াংজু গুদাম (Air)', type: 'textarea' }, { k: 'hk', label: 'হংকং গুদাম (Air)', type: 'textarea' }, { k: 'sea', label: 'Sea গুদাম', type: 'textarea' }] },
  seo: { label: 'SEO', list: false, fields: [{ k: 'title', label: 'সাইট টাইটেল' }, { k: 'description', label: 'বিবরণ (১৬০ অক্ষর)', type: 'textarea' }, { k: 'keywords', label: 'কীওয়ার্ড (কমা দিয়ে)' }, { k: 'ogImage', label: 'শেয়ার ছবি', type: 'image' }, { k: 'googleVerify', label: 'Google Search Console কোড' }, { k: 'fbPixel', label: 'Facebook Pixel ID' }, { k: 'gaId', label: 'Google Analytics ID' }] },
  pages: { label: 'পেজের লেখা', list: false, help: 'খালি রাখলে ডিফল্ট লেখা দেখাবে।', fields: [{ k: 'about', label: 'আমাদের সম্পর্কে', type: 'textarea' }, { k: 'terms', label: 'শর্তাবলি', type: 'textarea' }, { k: 'privacy', label: 'প্রাইভেসি', type: 'textarea' }, { k: 'refund', label: 'রিফান্ড নীতি', type: 'textarea' }, { k: 'banned', label: 'নিষিদ্ধ পণ্যের তালিকা', type: 'textarea' }] },
  blog: { label: 'ব্লগ', list: true, fields: [{ k: 'slug', label: 'URL (ইংরেজি, যেমন how-to-order)' }, { k: 'title', label: 'শিরোনাম' }, { k: 'date', label: 'তারিখ', type: 'date' }, { k: 'image', label: 'ছবি', type: 'image' }, { k: 'excerpt', label: 'সংক্ষেপ', type: 'textarea' }, { k: 'body', label: 'লেখা', type: 'textarea' }] },
  smsTemplates: { label: 'SMS / নোটিফিকেশন', list: false, help: 'প্রতিটি ঘটনায় SMS যাবে কিনা ও কী লেখা যাবে। {code} {status} {amount} বসানো যায়।', fields: [{ k: 'orderPlacedOn', label: 'অর্ডার হলে SMS', type: 'bool' }, { k: 'orderPlaced', label: 'অর্ডার হলে', type: 'textarea' }, { k: 'statusOn', label: 'অবস্থা বদলালে SMS', type: 'bool' }, { k: 'status', label: 'অবস্থা বদলালে', type: 'textarea' }, { k: 'paymentOn', label: 'পেমেন্ট পেলে SMS', type: 'bool' }, { k: 'payment', label: 'পেমেন্ট পেলে', type: 'textarea' }, { k: 'arrivedOn', label: 'দেশে পৌঁছালে SMS', type: 'bool' }, { k: 'arrived', label: 'দেশে পৌঁছালে', type: 'textarea' }] },
  abandonedCart: { label: 'অসমাপ্ত কার্ট রিমাইন্ডার', list: false, fields: [{ k: 'on', label: 'স্বয়ংক্রিয় রিমাইন্ডার চালু', type: 'bool' }, { k: 'hours', label: 'কত ঘণ্টা পর', type: 'number' }, { k: 'text', label: 'SMS লেখা', type: 'textarea' }] },
  gateways: { label: 'পেমেন্ট গেটওয়ে প্রদর্শন', list: false, help: 'গেটওয়ের গোপন কী শুধু সার্ভারের .env ফাইলে থাকে — এখানে কখনো লিখবেন না। এখানে শুধু কোনটা গ্রাহককে দেখাবেন তা ঠিক করুন।', fields: [{ k: 'bkashOn', label: 'bKash গেটওয়ে দেখান', type: 'bool' }, { k: 'sslczOn', label: 'কার্ড/Nagad (SSLCommerz) দেখান', type: 'bool' }, { k: 'manualOn', label: 'ম্যানুয়াল bKash/Nagad/ব্যাংক দেখান', type: 'bool' }] },
};

type Obj = Record<string, string | boolean | number>;

export default function Content() {
  const [key, setKey] = useState('banners');
  const s = SCHEMAS[key];
  const [value, setValue] = useState<Obj | Obj[] | null>(null);
  const act = useAction();

  useEffect(() => {
    setValue(null);
    api<Obj | Obj[] | null>(`/admin/content/${key}`).then((v) => setValue(v ?? (SCHEMAS[key].list ? [] : {}))).catch(() => setValue(SCHEMAS[key].list ? [] : {}));
  }, [key]);

  const save = () => act.run(() => api(`/admin/content/${key}`, { method: 'PUT', json: { value } }), 'সেভ হয়েছে — ওয়েবসাইটে ১ মিনিটের মধ্যে দেখাবে');
  const list = Array.isArray(value) ? value : [];

  return (
    <>
      <PageHead title="ওয়েবসাইট কনটেন্ট" />
      <div className="flex flex-col gap-4 lg:flex-row">
        <nav className="flex gap-2 overflow-x-auto lg:w-56 lg:flex-none lg:flex-col" aria-label="কনটেন্ট">
          {Object.entries(SCHEMAS).map(([k, v]) => (
            <button key={k} onClick={() => setKey(k)} className={`whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${k === key ? 'bg-navy text-white' : 'bg-white'}`}>{v.label}</button>
          ))}
        </nav>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <Panel title={s.label}>
            {s.help && <p className="rounded-lg bg-gold-chip p-2 text-sm text-gold-ink">{s.help}</p>}
            {value === null ? <p className="text-muted">লোড হচ্ছে…</p> : s.list ? (
              <>
                {list.map((row, i) => (
                  <div key={i} className="grid gap-2 rounded-xl border border-ivory-line p-3 md:grid-cols-2">
                    {s.fields.map((f) => <Input key={f.k} f={f} v={row[f.k]} on={(v) => setValue(list.map((r, j) => (j === i ? { ...r, [f.k]: v } : r)))} />)}
                    <div className="flex gap-2 md:col-span-2">
                      <button className="btn-outline h-9 min-h-0 px-3 text-sm" disabled={i === 0} onClick={() => { const n = [...list]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setValue(n); }}>↑</button>
                      <button className="btn-outline h-9 min-h-0 px-3 text-sm" disabled={i === list.length - 1} onClick={() => { const n = [...list]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; setValue(n); }}>↓</button>
                      <button className="btn-outline h-9 min-h-0 border-danger px-3 text-sm text-danger" onClick={() => setValue(list.filter((_, j) => j !== i))}>মুছুন</button>
                    </div>
                  </div>
                ))}
                <button className="btn-outline w-fit" onClick={() => setValue([...list, {}])}>+ নতুন যোগ করুন</button>
              </>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {s.fields.map((f) => <Input key={f.k} f={f} v={(value as Obj)[f.k]} on={(v) => setValue({ ...(value as Obj), [f.k]: v })} />)}
              </div>
            )}
            <Msg m={act.msg} />
            <button className="btn-gold w-fit" disabled={act.busy || value === null} onClick={save}>সেভ করুন</button>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Input({ f, v, on }: { f: F; v: string | boolean | number | undefined; on: (v: string | boolean | number) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (f.type === 'bool') return <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5" checked={!!v} onChange={(e) => on(e.target.checked)} />{f.label}</label>;
  if (f.type === 'textarea') return <Field label={f.label}><textarea className="input min-h-[110px]" value={String(v ?? '')} onChange={(e) => on(e.target.value)} /></Field>;
  if (f.type === 'image')
    return (
      <Field label={f.label}>
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {v ? <img src={String(v)} alt="" className="h-14 w-14 rounded-lg object-cover" /> : null}
          <input className="input min-w-0 flex-1" value={String(v ?? '')} onChange={(e) => on(e.target.value)} placeholder="https://… বা আপলোড" />
          <label className="btn-outline h-11 min-h-0 cursor-pointer px-3 text-sm">
            {busy ? '…' : 'আপলোড'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; setBusy(true); setErr(''); try { on(await uploadImage(file)); } catch { setErr('আপলোড হয়নি (৪ MB-এর কম JPG/PNG দিন)'); } finally { setBusy(false); } }} />
          </label>
        </div>
        {err && <span className="text-xs text-danger">{err}</span>}
      </Field>
    );
  return <Field label={f.label}><input className="input" type={f.type === 'date' ? 'date' : 'text'} inputMode={f.type === 'number' ? 'numeric' : undefined} value={String(v ?? '')} onChange={(e) => on(f.type === 'number' ? Number(e.target.value) || 0 : e.target.value)} /></Field>;
}
