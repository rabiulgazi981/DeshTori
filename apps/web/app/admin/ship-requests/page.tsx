'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Empty, Field, Msg, PageHead, Table, d, useAction, useApi } from '@/components/admin/ui';

const SHIP_BN: Record<string, string> = { AWAITING_ARRIVAL: 'আসার অপেক্ষায়', RECEIVED: 'গুদামে পৌঁছেছে', SHIPPED: 'পথে', ARRIVED_BD: 'বাংলাদেশে', DELIVERED: 'ডেলিভারি', CANCELLED: 'বাতিল' };
const WH: Record<string, string> = { GZ_AIR: 'গুয়াংজু (Air)', HK_AIR: 'হংকং (Air)', SEA: 'Sea' };
interface S { id: string; code: string; warehouse: string; trackingNo: string; cartons: number; totalPieces: number; description: string; category: string; extraService: string; status: string; receivedCartons: number | null; receivedPieces: number | null; weightKg: number | null; createdAt: string; user: { name: string | null; phone: string; customerCode: string | null } }

export default function ShipRequests() {
  const [status, setStatus] = useState('AWAITING_ARRIVAL');
  const { data, err, reload } = useApi<S[]>(`/admin/ship-requests${status ? `?status=${status}` : ''}`);
  const [edit, setEdit] = useState<S | null>(null);
  const [f, setF] = useState({ status: 'RECEIVED', receivedCartons: '', receivedPieces: '', weightKg: '' });
  const act = useAction();
  const open = (s: S) => { setEdit(s); setF({ status: s.status === 'AWAITING_ARRIVAL' ? 'RECEIVED' : s.status, receivedCartons: String(s.receivedCartons ?? s.cartons), receivedPieces: String(s.receivedPieces ?? s.totalPieces), weightKg: String(s.weightKg ?? '') }); };
  const save = () => edit && act.run(async () => {
    await api(`/admin/ship-requests/${edit.code}`, { method: 'PATCH', json: { status: f.status, receivedCartons: Number(f.receivedCartons) || undefined, receivedPieces: Number(f.receivedPieces) || undefined, weightKg: Number(f.weightKg) || undefined } });
    setEdit(null);
    await reload();
  }, 'আপডেট হয়েছে, গ্রাহক SMS পেয়েছেন');
  return (
    <>
      <PageHead title="শিপিং পার্সেল (Ship for me)">
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">সব</option>
          {Object.entries(SHIP_BN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </PageHead>
      <Msg m={act.msg} />
      {err && <p className="text-danger">{err}</p>}
      {edit && (
        <div className="card mb-3 grid gap-2 p-4 md:grid-cols-5">
          <b className="md:col-span-5">{edit.code} · মার্ক {edit.user.customerCode} · ট্র্যাকিং {edit.trackingNo} · ঘোষিত {edit.cartons} কার্টন / {edit.totalPieces} পিস</b>
          <Field label="অবস্থা"><select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{Object.entries(SHIP_BN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="পাওয়া কার্টন"><input className="input" inputMode="numeric" value={f.receivedCartons} onChange={(e) => setF({ ...f, receivedCartons: e.target.value })} /></Field>
          <Field label="পাওয়া পিস"><input className="input" inputMode="numeric" value={f.receivedPieces} onChange={(e) => setF({ ...f, receivedPieces: e.target.value })} /></Field>
          <Field label="ওজন (কেজি)"><input className="input" inputMode="decimal" value={f.weightKg} onChange={(e) => setF({ ...f, weightKg: e.target.value })} /></Field>
          <div className="flex items-end gap-2"><button className="btn-gold" disabled={act.busy} onClick={save}>সেভ</button><button className="btn-outline" onClick={() => setEdit(null)}>বাতিল</button></div>
        </div>
      )}
      {data && !data.length ? <Empty /> : (
        <Table head={['কোড', 'তারিখ', 'গ্রাহক / মার্ক', 'গুদাম', 'ট্র্যাকিং', 'কার্টন', 'পিস', 'পণ্য', 'ক্যাটা.', 'অতিরিক্ত', 'অবস্থা', '']} min={1100}>
          {data?.map((s) => (
            <tr key={s.id}>
              <td className="font-bold">{s.code}</td>
              <td>{d(s.createdAt)}</td>
              <td>{s.user.name}<br /><b>{s.user.customerCode}</b></td>
              <td>{WH[s.warehouse]}</td>
              <td><code>{s.trackingNo}</code></td>
              <td>{s.receivedCartons != null ? `${s.receivedCartons}/` : ''}{s.cartons}</td>
              <td>{s.receivedPieces != null ? `${s.receivedPieces}/` : ''}{s.totalPieces}</td>
              <td className="max-w-[200px]">{s.description}</td>
              <td>{s.category}</td>
              <td>{s.extraService === 'NONE' ? '—' : s.extraService}</td>
              <td>{SHIP_BN[s.status]}{s.weightKg ? ` · ${s.weightKg} কেজি` : ''}</td>
              <td><button className="btn-outline h-9 min-h-0 px-3 text-sm" onClick={() => open(s)}>আপডেট</button></td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
