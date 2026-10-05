'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { can, useMe } from '@/components/admin/me';
import { Empty, Field, Msg, PageHead, Panel, Table, TakaInput, d, tk, useAction, useApi } from '@/components/admin/ui';

interface C { id: string; code: string; type: string; value: number; minOrder: number | null; maxDiscount: number | null; usageLimit: number | null; perUser: number; used: number; firstOrderOnly: boolean; startsAt: string | null; endsAt: string | null; active: boolean }
const TYPES: Record<string, string> = { PERCENT: 'পণ্যে % ছাড়', FLAT: 'পণ্যে ফ্ল্যাট ছাড় (৳)', FREIGHT_PERCENT: 'শিপিং চার্জে % ছাড়', FREE_BD_DELIVERY: 'ফ্রি দেশি ডেলিভারি' };
const blank = { code: '', type: 'PERCENT', value: 0, minOrder: 0, maxDiscount: 0, usageLimit: '', perUser: '1', firstOrderOnly: false, startsAt: '', endsAt: '', active: true };

export default function Coupons() {
  const me = useMe();
  const { data, err, reload } = useApi<C[]>('/admin/coupons');
  const act = useAction();
  const [f, setF] = useState(blank);
  const owner = can(me, ['OWNER']);
  const isMoney = f.type === 'FLAT';
  const save = () => act.run(async () => {
    await api('/admin/coupons', { method: 'POST', json: {
      code: f.code, type: f.type, value: f.value, active: f.active, firstOrderOnly: f.firstOrderOnly,
      minOrder: f.minOrder || undefined, maxDiscount: f.maxDiscount || undefined,
      usageLimit: Number(f.usageLimit) || undefined, perUser: Number(f.perUser) || 1,
      startsAt: f.startsAt || undefined, endsAt: f.endsAt || undefined,
    } });
    setF(blank);
    await reload();
  });
  const edit = (c: C) => setF({ code: c.code, type: c.type, value: c.value, minOrder: c.minOrder ?? 0, maxDiscount: c.maxDiscount ?? 0, usageLimit: c.usageLimit ? String(c.usageLimit) : '', perUser: String(c.perUser), firstOrderOnly: c.firstOrderOnly, startsAt: c.startsAt?.slice(0, 10) ?? '', endsAt: c.endsAt?.slice(0, 10) ?? '', active: c.active });
  return (
    <>
      <PageHead title="কুপন ও ক্যাম্পেইন" />
      {owner && (
        <Panel title="কুপন তৈরি / সম্পাদনা" className="mb-4">
          <div className="grid gap-2 md:grid-cols-4">
            <Field label="কোড"><input className="input uppercase" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
            <Field label="ধরন"><select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value, value: 0 })}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label={isMoney ? 'ছাড় (৳)' : 'ছাড় (%)'}>{isMoney ? <TakaInput value={f.value} onChange={(v) => setF({ ...f, value: v })} /> : <input className="input" inputMode="numeric" value={f.value || ''} onChange={(e) => setF({ ...f, value: Number(e.target.value) || 0 })} />}</Field>
            <Field label="ন্যূনতম অর্ডার"><TakaInput value={f.minOrder} onChange={(v) => setF({ ...f, minOrder: v })} /></Field>
            <Field label="সর্বোচ্চ ছাড়"><TakaInput value={f.maxDiscount} onChange={(v) => setF({ ...f, maxDiscount: v })} /></Field>
            <Field label="মোট ব্যবহারের সীমা"><input className="input" inputMode="numeric" value={f.usageLimit} onChange={(e) => setF({ ...f, usageLimit: e.target.value })} placeholder="সীমাহীন" /></Field>
            <Field label="প্রতি গ্রাহক"><input className="input" inputMode="numeric" value={f.perUser} onChange={(e) => setF({ ...f, perUser: e.target.value })} /></Field>
            <Field label="শুরু"><input type="date" className="input" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} /></Field>
            <Field label="শেষ"><input type="date" className="input" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5" checked={f.firstOrderOnly} onChange={(e) => setF({ ...f, firstOrderOnly: e.target.checked })} />শুধু প্রথম অর্ডারে</label>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />চালু</label>
            <button className="btn-gold self-end" disabled={!f.code || act.busy} onClick={save}>সেভ</button>
          </div>
          <Msg m={act.msg} />
          <p className="text-xs text-muted">ক্যাম্পেইন ব্যানার/পপআপ “ওয়েবসাইট কনটেন্ট” পেজ থেকে চালু করুন এবং সেখানে কুপন কোড লিখে দিন।</p>
        </Panel>
      )}
      {err && <p className="text-danger">{err}</p>}
      {data && !data.length ? <Empty /> : (
        <Table head={['কোড', 'ধরন', 'ছাড়', 'ন্যূনতম', 'ব্যবহার', 'মেয়াদ', 'অবস্থা', '']} min={800}>
          {data?.map((c) => (
            <tr key={c.id}>
              <td className="font-bold">{c.code}</td><td>{TYPES[c.type]}</td><td>{c.type === 'FLAT' ? tk(c.value) : `${c.value}%`}</td><td>{c.minOrder ? tk(c.minOrder) : '—'}</td>
              <td>{c.used}{c.usageLimit ? `/${c.usageLimit}` : ''}</td><td>{d(c.startsAt)} – {d(c.endsAt)}</td><td>{c.active ? 'চালু' : 'বন্ধ'}</td>
              <td>{owner && <button className="btn-outline h-9 min-h-0 px-3 text-sm" onClick={() => edit(c)}>সম্পাদনা</button>}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
