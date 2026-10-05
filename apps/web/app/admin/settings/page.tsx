'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Field, Msg, PageHead, Panel, Table, TakaInput, useAction, useApi } from '@/components/admin/ui';

interface S { pricing: { cnyRate: number; marginPct: number }; useOriginalPrice: boolean; advancePlans: { percent: number; discountPct: number }[]; notice: { on: boolean; textBn: string; textEn: string; hotline: string; link?: string; speed: 'slow' | 'normal' | 'fast' } }
interface Fr { id: string; code: string; nameBn: string; itemsBn: string; airPaisa: number; seaPaisa: number; minKg: number; active: boolean }
interface K { id: string; keyword: string }

export default function Settings() {
  const { data: s, reload } = useApi<S>('/admin/settings');
  const act = useAction();
  const [p, setP] = useState({ cnyRate: '', marginPct: '', useOriginalPrice: true });
  const [n, setN] = useState<S['notice'] | null>(null);
  const [plans, setPlans] = useState<S['advancePlans']>([]);
  useEffect(() => {
    if (!s) return;
    setP({ cnyRate: String(s.pricing.cnyRate), marginPct: String(s.pricing.marginPct), useOriginalPrice: s.useOriginalPrice });
    setN(s.notice);
    setPlans(s.advancePlans);
  }, [s]);

  return (
    <>
      <PageHead title="রেট, নোটিশ ও নিষিদ্ধ তালিকা" />
      <Msg m={act.msg} />
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <Panel title="মূল্য নির্ধারণ (গোপন — গ্রাহক কখনো দেখবে না)">
          <div className="grid grid-cols-2 gap-2">
            <Field label="¥1 = কত টাকা"><input className="input" inputMode="decimal" value={p.cnyRate} onChange={(e) => setP({ ...p, cnyRate: e.target.value })} /></Field>
            <Field label="মার্জিন %"><input className="input" inputMode="decimal" value={p.marginPct} onChange={(e) => setP({ ...p, marginPct: e.target.value })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5" checked={p.useOriginalPrice} onChange={(e) => setP({ ...p, useOriginalPrice: e.target.checked })} />সাপ্লায়ারের আসল দাম ধরুন (বন্ধ করলে প্রোমো দাম)</label>
          <p className="text-xs text-muted">নতুন রেট শুধু নতুন অর্ডারে লাগবে। পুরনো অর্ডারের রেট লক করা থাকে।</p>
          <button className="btn-gold w-fit" disabled={act.busy} onClick={() => act.run(async () => { await api('/admin/settings/pricing', { method: 'PUT', json: { cnyRate: Number(p.cnyRate), marginPct: Number(p.marginPct), useOriginalPrice: p.useOriginalPrice } }); await reload(); })}>সেভ</button>
        </Panel>

        <Panel title="অগ্রিম পেমেন্ট প্ল্যান">
          {plans.map((pl, i) => (
            <div key={pl.percent} className="grid grid-cols-2 items-end gap-2">
              <span className="font-bold">{pl.percent}% অগ্রিম</span>
              <Field label="ছাড় %"><input className="input" inputMode="decimal" value={pl.discountPct} onChange={(e) => setPlans(plans.map((x, j) => (j === i ? { ...x, discountPct: Number(e.target.value) || 0 } : x)))} /></Field>
            </div>
          ))}
          <button className="btn-gold w-fit" disabled={act.busy} onClick={() => act.run(async () => { await api('/admin/settings/advance-plans', { method: 'PUT', json: { plans } }); await reload(); })}>সেভ</button>
        </Panel>

        {n && (
          <Panel title="উপরের চলমান নোটিশ" className="lg:col-span-2">
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5" checked={n.on} onChange={(e) => setN({ ...n, on: e.target.checked })} />চালু</label>
            <Field label="বাংলা"><textarea className="input" value={n.textBn} onChange={(e) => setN({ ...n, textBn: e.target.value })} /></Field>
            <Field label="English"><textarea className="input" value={n.textEn} onChange={(e) => setN({ ...n, textEn: e.target.value })} /></Field>
            <div className="grid gap-2 md:grid-cols-3">
              <Field label="হটলাইন"><input className="input" value={n.hotline} onChange={(e) => setN({ ...n, hotline: e.target.value })} /></Field>
              <Field label="লিংক (ঐচ্ছিক)"><input className="input" value={n.link ?? ''} onChange={(e) => setN({ ...n, link: e.target.value })} /></Field>
              <Field label="গতি"><select className="input" value={n.speed} onChange={(e) => setN({ ...n, speed: e.target.value as 'slow' })}><option value="slow">ধীরে</option><option value="normal">স্বাভাবিক</option><option value="fast">দ্রুত</option></select></Field>
            </div>
            <button className="btn-gold w-fit" disabled={act.busy} onClick={() => act.run(async () => { await api('/admin/settings/notice', { method: 'PUT', json: { ...n, link: n.link || undefined } }); await reload(); })}>সেভ</button>
          </Panel>
        )}
      </div>
      <Freight />
      <Blocked />
    </>
  );
}

function Freight() {
  const { data, reload } = useApi<Fr[]>('/admin/freight');
  const act = useAction();
  const [rows, setRows] = useState<Fr[]>([]);
  useEffect(() => setRows(data ?? []), [data]);
  const set = (i: number, patch: Partial<Fr>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <Panel title="শিপিং রেট (প্রতি কেজি)" className="mt-4">
      <Msg m={act.msg} />
      <Table head={['ক্যাটাগরি', 'নাম', 'কী কী পণ্য', 'Air', 'Sea', 'ন্যূনতম কেজি', 'চালু', '']} min={1000}>
        {rows.map((r, i) => (
          <tr key={r.code}>
            <td className="font-bold">{r.code}</td>
            <td><input className="input py-1.5" value={r.nameBn} onChange={(e) => set(i, { nameBn: e.target.value })} /></td>
            <td><textarea className="input min-h-[70px] py-1.5 text-sm" value={r.itemsBn} onChange={(e) => set(i, { itemsBn: e.target.value })} /></td>
            <td className="w-28"><TakaInput value={r.airPaisa} onChange={(v) => set(i, { airPaisa: v })} /></td>
            <td className="w-28"><TakaInput value={r.seaPaisa} onChange={(v) => set(i, { seaPaisa: v })} /></td>
            <td className="w-24"><input className="input py-1.5" inputMode="decimal" value={r.minKg} onChange={(e) => set(i, { minKg: Number(e.target.value) || 0 })} /></td>
            <td><input type="checkbox" className="h-5 w-5" checked={r.active} onChange={(e) => set(i, { active: e.target.checked })} /></td>
            <td><button className="btn-gold h-9 min-h-0 px-3 text-sm" disabled={act.busy} onClick={() => act.run(async () => { const { nameBn, itemsBn, airPaisa, seaPaisa, minKg, active } = r; await api(`/admin/freight/${r.code}`, { method: 'PUT', json: { nameBn, itemsBn, airPaisa, seaPaisa, minKg, active } }); await reload(); })}>সেভ</button></td>
          </tr>
        ))}
      </Table>
    </Panel>
  );
}

function Blocked() {
  const { data, reload } = useApi<K[]>('/admin/blocked-keywords');
  const act = useAction();
  const [k, setK] = useState('');
  return (
    <Panel title="নিষিদ্ধ শব্দ (এগুলো সার্চে আসবে না)" className="mt-4">
      <Msg m={act.msg} />
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void act.run(async () => { await api('/admin/blocked-keywords', { method: 'POST', json: { keyword: k } }); setK(''); await reload(); }); }}>
        <input className="input max-w-xs" value={k} onChange={(e) => setK(e.target.value)} placeholder="যেমন: gun" />
        <button className="btn-gold" disabled={k.trim().length < 2}>যোগ</button>
      </form>
      <div className="flex flex-wrap gap-2">
        {data?.map((x) => (
          <span key={x.id} className="chip gap-1 bg-ivory-ph py-1 text-sm">{x.keyword}<button aria-label={`${x.keyword} মুছুন`} className="ml-1 text-danger" onClick={() => act.run(async () => { await api(`/admin/blocked-keywords/${x.id}`, { method: 'DELETE' }); await reload(); }, 'মুছে ফেলা হয়েছে')}>✕</button></span>
        ))}
      </div>
    </Panel>
  );
}
