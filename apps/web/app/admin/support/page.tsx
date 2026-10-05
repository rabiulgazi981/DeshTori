'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Empty, Field, Msg, PageHead, Panel, TakaInput, dt, useAction, useApi } from '@/components/admin/ui';

type Msg_ = { from: 'customer' | 'staff'; text: string; at: string };
interface T { id: string; code: string; subject: string; status: string; messages: Msg_[]; updatedAt: string; user: { name: string | null; phone: string; customerCode: string | null } }
interface Cp { id: string; code: string; kind: string; qty: number; wants: string; details: string; media: string[]; status: string; resolution: string | null; createdAt: string; user: { name: string | null; phone: string; customerCode: string | null } }
const KIND: Record<string, string> = { DAMAGED: 'ভাঙা/নষ্ট', SHORT: 'কম এসেছে', WRONG_VARIANT: 'ভুল ভ্যারিয়েন্ট', WRONG_ITEM: 'ভুল পণ্য', OTHER: 'অন্যান্য' };
const WANTS: Record<string, string> = { REFUND: 'টাকা ফেরত', REPLACE: 'বদলে দিন', PARTIAL: 'আংশিক ফেরত' };

export default function Support() {
  const [tab, setTab] = useState<'t' | 'c'>('t');
  return (
    <>
      <PageHead title="সাপোর্ট ও অভিযোগ">
        <button className={tab === 't' ? 'btn-navy' : 'btn-outline'} onClick={() => setTab('t')}>টিকেট</button>
        <button className={tab === 'c' ? 'btn-navy' : 'btn-outline'} onClick={() => setTab('c')}>অভিযোগ</button>
      </PageHead>
      {tab === 't' ? <Tickets /> : <Complaints />}
    </>
  );
}

function Tickets() {
  const { data, err, reload } = useApi<T[]>('/admin/tickets');
  const act = useAction();
  const [reply, setReply] = useState<Record<string, string>>({});
  const send = (code: string, status?: string) => act.run(async () => { await api(`/admin/tickets/${code}/reply`, { method: 'POST', json: { text: reply[code] || 'টিকেট বন্ধ করা হলো।', status } }); setReply({ ...reply, [code]: '' }); await reload(); }, 'উত্তর পাঠানো হয়েছে');
  if (err) return <p className="text-danger">{err}</p>;
  if (data && !data.length) return <Empty text="কোনো টিকেট নেই" />;
  return (
    <div className="flex flex-col gap-3">
      <Msg m={act.msg} />
      {data?.map((t) => (
        <Panel key={t.id}>
          <div className="flex flex-wrap items-center gap-2"><b>{t.code} · {t.subject}</b><span className="chip bg-ivory-ph">{t.status}</span><span className="text-sm text-muted">{t.user.name} · {t.user.phone} · {t.user.customerCode}</span></div>
          <div className="flex flex-col gap-1.5">
            {t.messages.map((m, i) => <p key={i} className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.from === 'staff' ? 'self-end bg-navy text-white' : 'bg-ivory'}`}>{m.text}<span className="block text-[11px] opacity-70">{dt(m.at)}</span></p>)}
          </div>
          {t.status !== 'CLOSED' && (
            <div className="flex flex-wrap gap-2">
              <input className="input min-w-0 flex-1" placeholder="উত্তর লিখুন" value={reply[t.code] ?? ''} onChange={(e) => setReply({ ...reply, [t.code]: e.target.value })} />
              <button className="btn-gold" disabled={!reply[t.code] || act.busy} onClick={() => send(t.code)}>পাঠান</button>
              <button className="btn-outline" disabled={act.busy} onClick={() => send(t.code, 'CLOSED')}>বন্ধ করুন</button>
            </div>
          )}
        </Panel>
      ))}
    </div>
  );
}

function Complaints() {
  const { data, err, reload } = useApi<Cp[]>('/admin/complaints');
  const act = useAction();
  const [f, setF] = useState<Record<string, { resolution: string; refundPaisa: number }>>({});
  const resolve = (code: string, status: string) => act.run(async () => { const v = f[code] ?? { resolution: '', refundPaisa: 0 }; await api(`/admin/complaints/${code}`, { method: 'PATCH', json: { status, resolution: v.resolution || (status === 'REJECTED' ? 'অভিযোগ গ্রহণযোগ্য নয়' : 'সমাধান করা হয়েছে'), refundPaisa: v.refundPaisa || undefined } }); await reload(); }, 'সমাধান সেভ হয়েছে, গ্রাহক SMS পেয়েছেন');
  if (err) return <p className="text-danger">{err}</p>;
  if (data && !data.length) return <Empty text="কোনো অভিযোগ নেই" />;
  return (
    <div className="flex flex-col gap-3">
      <Msg m={act.msg} />
      {data?.map((c) => (
        <Panel key={c.id}>
          <div className="flex flex-wrap items-center gap-2"><b>{c.code}</b><span className="chip bg-gold-chip text-gold-ink">{KIND[c.kind]} · {c.qty} পিস · চান: {WANTS[c.wants]}</span><span className="chip bg-ivory-ph">{c.status}</span><span className="text-sm text-muted">{c.user.name} · {c.user.phone} · {dt(c.createdAt)}</span></div>
          <p>{c.details}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="flex flex-wrap gap-2">{c.media.map((m) => <a key={m} href={m} target="_blank" rel="noreferrer"><img src={m} alt="" className="h-20 w-20 rounded-lg object-cover" /></a>)}</div>
          {c.status === 'REVIEW' ? (
            <div className="grid gap-2 md:grid-cols-[1fr_180px_auto_auto]">
              <Field label="সমাধান"><input className="input" value={f[c.code]?.resolution ?? ''} onChange={(e) => setF({ ...f, [c.code]: { refundPaisa: f[c.code]?.refundPaisa ?? 0, resolution: e.target.value } })} /></Field>
              <Field label="ওয়ালেটে ফেরত"><TakaInput value={f[c.code]?.refundPaisa ?? 0} onChange={(v) => setF({ ...f, [c.code]: { resolution: f[c.code]?.resolution ?? '', refundPaisa: v } })} /></Field>
              <button className="btn-gold self-end" disabled={act.busy} onClick={() => resolve(c.code, 'RESOLVED')}>সমাধান</button>
              <button className="btn-outline self-end" disabled={act.busy} onClick={() => resolve(c.code, 'REJECTED')}>প্রত্যাখ্যান</button>
            </div>
          ) : <p className="text-sm text-muted">ফলাফল: {c.resolution}</p>}
        </Panel>
      ))}
    </div>
  );
}
