'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Empty, Field, Msg, PageHead, Panel, Table, TakaInput, d, tk, useAction, useApi } from '@/components/admin/ui';

interface Sh { id: string; code: string; mode: string; route: string; carrier: string | null; awb: string | null; costPaisa: number | null; status: string; sentAt: string | null; arrivedAt: string | null; _count: { orders: number; shipRequests: number } }
interface O { code: string; user: { customerCode: string | null }; shipMode: string }
interface SR { code: string; warehouse: string; user: { customerCode: string | null }; weightKg: number | null }

export default function Shipments() {
  const { data, err, reload } = useApi<Sh[]>('/admin/shipments');
  const ready = useApi<O[]>('/admin/orders?status=AT_CN_WAREHOUSE');
  const parcels = useApi<SR[]>('/admin/ship-requests?status=RECEIVED');
  const act = useAction();
  const [f, setF] = useState({ mode: 'AIR', route: 'GZ_AIR', carrier: '', awb: '', costPaisa: 0 });
  const [orders, setOrders] = useState<string[]>([]);
  const [srs, setSrs] = useState<string[]>([]);
  const toggle = (list: string[], set: (v: string[]) => void, c: string) => set(list.includes(c) ? list.filter((x) => x !== c) : [...list, c]);

  const create = () => act.run(async () => {
    await api('/admin/shipments', { method: 'POST', json: { ...f, carrier: f.carrier || undefined, awb: f.awb || undefined, costPaisa: f.costPaisa || undefined, orderCodes: orders, shipRequestCodes: srs } });
    setOrders([]); setSrs([]);
    await Promise.all([reload(), ready.reload(), parcels.reload()]);
  }, 'শিপমেন্ট তৈরি হয়েছে, গ্রাহকরা SMS পেয়েছেন');
  const arrive = (code: string) => act.run(async () => { await api(`/admin/shipments/${code}`, { method: 'PATCH', json: { status: 'ARRIVED_BD' } }); await reload(); }, 'বাংলাদেশে পৌঁছেছে — সব গ্রাহক SMS পেয়েছেন');

  const readyOrders = (ready.data ?? []).filter((o) => o.shipMode === f.mode);
  const readyParcels = (parcels.data ?? []).filter((s) => (f.mode === 'SEA' ? s.warehouse === 'SEA' : s.warehouse !== 'SEA'));

  return (
    <>
      <PageHead title="শিপমেন্ট (ফ্লাইট / জাহাজ)" />
      <Msg m={act.msg} />
      <Panel title="নতুন শিপমেন্ট" className="mb-4">
        <div className="grid gap-2 md:grid-cols-5">
          <Field label="মাধ্যম"><select className="input" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value, route: e.target.value === 'SEA' ? 'SEA' : 'GZ_AIR' })}><option value="AIR">Air</option><option value="SEA">Sea</option></select></Field>
          <Field label="রুট"><select className="input" value={f.route} onChange={(e) => setF({ ...f, route: e.target.value })}>{f.mode === 'AIR' ? <><option value="GZ_AIR">গুয়াংজু</option><option value="HK_AIR">হংকং</option></> : <option value="SEA">Sea</option>}</select></Field>
          <Field label="ক্যারিয়ার"><input className="input" value={f.carrier} onChange={(e) => setF({ ...f, carrier: e.target.value })} /></Field>
          <Field label="AWB / BL নম্বর"><input className="input" value={f.awb} onChange={(e) => setF({ ...f, awb: e.target.value })} /></Field>
          <Field label="খরচ (হিসাবে যাবে)"><TakaInput value={f.costPaisa} onChange={(v) => setF({ ...f, costPaisa: v })} /></Field>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <b className="text-sm">গুদামে প্রস্তুত অর্ডার ({readyOrders.length})</b>
            <div className="mt-1 flex max-h-56 flex-col gap-1 overflow-y-auto rounded-xl border border-ivory-line p-2">
              {readyOrders.map((o) => <label key={o.code} className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={orders.includes(o.code)} onChange={() => toggle(orders, setOrders, o.code)} />{o.code} · {o.user.customerCode}</label>)}
              {!readyOrders.length && <span className="text-sm text-muted">নেই</span>}
            </div>
          </div>
          <div>
            <b className="text-sm">গুদামে পৌঁছানো পার্সেল ({readyParcels.length})</b>
            <div className="mt-1 flex max-h-56 flex-col gap-1 overflow-y-auto rounded-xl border border-ivory-line p-2">
              {readyParcels.map((s) => <label key={s.code} className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={srs.includes(s.code)} onChange={() => toggle(srs, setSrs, s.code)} />{s.code} · {s.user.customerCode}{s.weightKg ? ` · ${s.weightKg} কেজি` : ''}</label>)}
              {!readyParcels.length && <span className="text-sm text-muted">নেই</span>}
            </div>
          </div>
        </div>
        <button className="btn-gold w-fit" disabled={act.busy || (!orders.length && !srs.length)} onClick={create}>✈️ শিপমেন্ট পাঠান ({orders.length + srs.length})</button>
      </Panel>
      {err && <p className="text-danger">{err}</p>}
      {data && !data.length ? <Empty /> : (
        <Table head={['কোড', 'রুট', 'ক্যারিয়ার / AWB', 'অর্ডার', 'পার্সেল', 'খরচ', 'পাঠানো', 'পৌঁছানো', '']} min={900}>
          {data?.map((s) => (
            <tr key={s.id}>
              <td className="font-bold">{s.code}</td>
              <td>{s.route}</td>
              <td>{s.carrier ?? '—'} {s.awb && <code className="text-xs">{s.awb}</code>}</td>
              <td>{s._count.orders}</td>
              <td>{s._count.shipRequests}</td>
              <td>{s.costPaisa ? tk(s.costPaisa) : '—'}</td>
              <td>{d(s.sentAt)}</td>
              <td>{d(s.arrivedAt)}</td>
              <td>{s.status === 'SHIPPED' && <button className="btn-navy h-9 min-h-0 px-3 text-sm" disabled={act.busy} onClick={() => arrive(s.code)}>বাংলাদেশে পৌঁছেছে</button>}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
