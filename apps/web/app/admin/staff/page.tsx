'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useMe } from '@/components/admin/me';
import { Field, Msg, PageHead, Panel, Table, d, dt, useAction, useApi } from '@/components/admin/ui';

const ROLE_BN: Record<string, string> = { OWNER: 'মালিক (সব)', BD_ORDER: 'বিডি অর্ডার', CN_PURCHASE: 'চায়না ক্রয়', CN_WAREHOUSE: 'চায়না গুদাম', SHIPMENT: 'শিপমেন্ট', BD_DELIVERY: 'বিডি ডেলিভারি', ACCOUNTS: 'হিসাব' };
interface St { id: string; phone: string; name: string | null; roles: string[]; isBlocked: boolean; createdAt: string }
interface A { id: string; actorId: string | null; action: string; entity: string; entityId: string | null; after: unknown; createdAt: string }

export default function Staff() {
  const me = useMe();
  const { data, reload } = useApi<St[]>('/admin/staff');
  const audit = useApi<A[]>('/admin/audit');
  const act = useAction();
  const [f, setF] = useState({ phone: '', name: '', password: '', roles: [] as string[] });
  const names = Object.fromEntries((data ?? []).map((s) => [s.id, s.name ?? s.phone]));
  const toggle = (list: string[], r: string) => (list.includes(r) ? list.filter((x) => x !== r) : [...list, r]);

  return (
    <>
      <PageHead title="স্টাফ ও অডিট" />
      <Msg m={act.msg} />
      <Panel title="নতুন স্টাফ" className="my-3">
        <div className="grid gap-2 md:grid-cols-3">
          <Field label="মোবাইল"><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="নাম"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="প্রথম পাসওয়ার্ড (৮+ অক্ষর ও সংখ্যা)"><input className="input" type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        </div>
        <div className="flex flex-wrap gap-3">
          {Object.entries(ROLE_BN).map(([r, l]) => <label key={r} className="flex items-center gap-1.5 text-sm"><input type="checkbox" className="h-5 w-5" checked={f.roles.includes(r)} onChange={() => setF({ ...f, roles: toggle(f.roles, r) })} />{l}</label>)}
        </div>
        <p className="text-xs text-muted">স্টাফ লগইনে প্রতিবার পাসওয়ার্ডের পর মোবাইলে OTP লাগবে।</p>
        <button className="btn-gold w-fit" disabled={!f.phone || !f.name || !f.roles.length || f.password.length < 8 || act.busy} onClick={() => act.run(async () => { await api('/admin/staff', { method: 'POST', json: f }); setF({ phone: '', name: '', password: '', roles: [] }); await reload(); }, 'স্টাফ যোগ হয়েছে')}>যোগ করুন</button>
      </Panel>
      <Table head={['নাম', 'মোবাইল', 'রোল', 'যোগদান', '']} min={800}>
        {data?.map((s) => (
          <tr key={s.id}>
            <td className="font-bold">{s.name} {s.isBlocked && <span className="chip bg-[#FBE9E6] text-danger">বন্ধ</span>}</td>
            <td>{s.phone}</td>
            <td>
              <div className="flex flex-wrap gap-2">
                {Object.entries(ROLE_BN).map(([r, l]) => (
                  <label key={r} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={s.roles.includes(r)} disabled={s.id === me?.id && r === 'OWNER'} onChange={() => act.run(async () => { await api(`/admin/staff/${s.id}`, { method: 'PATCH', json: { roles: toggle(s.roles, r) } }); await reload(); }, 'রোল আপডেট — স্টাফকে আবার লগইন করতে হবে')} />{l}</label>
                ))}
              </div>
            </td>
            <td>{d(s.createdAt)}</td>
            <td>{s.id !== me?.id && <button className="btn-outline h-9 min-h-0 px-3 text-sm" onClick={() => act.run(async () => { await api(`/admin/staff/${s.id}`, { method: 'PATCH', json: { isBlocked: !s.isBlocked } }); await reload(); })}>{s.isBlocked ? 'চালু করুন' : 'বন্ধ করুন'}</button>}</td>
          </tr>
        ))}
      </Table>
      <Panel title="অডিট লগ (কে কী বদলেছে)" className="mt-4">
        <Table head={['সময়', 'কে', 'কাজ', 'কী', 'বিস্তারিত']} min={800}>
          {audit.data?.map((a) => (
            <tr key={a.id}><td className="whitespace-nowrap">{dt(a.createdAt)}</td><td>{a.actorId ? names[a.actorId] ?? 'গ্রাহক/সিস্টেম' : 'সিস্টেম'}</td><td>{a.action}</td><td>{a.entity}</td><td className="max-w-[360px] truncate text-xs"><code>{JSON.stringify(a.after)}</code></td></tr>
          ))}
        </Table>
      </Panel>
    </>
  );
}
