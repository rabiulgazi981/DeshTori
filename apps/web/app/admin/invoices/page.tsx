'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Empty, Field, Msg, PageHead, Panel, Table, d, tk, useAction, useApi } from '@/components/admin/ui';

interface Inv { id: string; code: string; kind: string; totalPaisa: number; paidPaisa: number; status: string; createdAt: string }

export default function Invoices() {
  const router = useRouter();
  const { data, err } = useApi<Inv[]>('/admin/invoices');
  const act = useAction();
  const [codes, setCodes] = useState('');
  const [kind, setKind] = useState('DELIVERY');
  const create = async () => {
    const list = codes.split(/[\s,]+/).map((c) => c.trim().toUpperCase()).filter(Boolean);
    const inv = await act.run(() => api<{ code: string }>('/admin/invoices', { method: 'POST', json: { orderCodes: list, kind } }));
    if (inv) router.push(`/invoice/${inv.code}`);
  };
  return (
    <>
      <PageHead title="ইনভয়েস" />
      <Panel title="নতুন ইনভয়েস (একই গ্রাহকের একাধিক অর্ডার একসাথে)" className="mb-4">
        <div className="grid gap-2 md:grid-cols-[1fr_200px_auto]">
          <Field label="অর্ডার কোড (কমা দিয়ে)"><input className="input" value={codes} onChange={(e) => setCodes(e.target.value)} placeholder="DT-10001, DT-10004" /></Field>
          <Field label="ধরন"><select className="input" value={kind} onChange={(e) => setKind(e.target.value)}><option value="DELIVERY">ডেলিভারি</option><option value="ADVANCE">অগ্রিম</option><option value="CUSTOM">অন্যান্য</option></select></Field>
          <button className="btn-gold self-end" disabled={!codes.trim() || act.busy} onClick={create}>তৈরি করুন</button>
        </div>
        <Msg m={act.msg} />
      </Panel>
      {err && <p className="text-danger">{err}</p>}
      {data && !data.length ? <Empty /> : (
        <Table head={['কোড', 'তারিখ', 'ধরন', 'মোট', 'পরিশোধিত', 'বাকি', 'অবস্থা', '']}>
          {data?.map((i) => (
            <tr key={i.id}>
              <td className="font-bold">{i.code}</td><td>{d(i.createdAt)}</td><td>{i.kind}</td>
              <td>{tk(i.totalPaisa)}</td><td>{tk(i.paidPaisa)}</td><td className="font-bold">{tk(i.totalPaisa - i.paidPaisa)}</td><td>{i.status}</td>
              <td><Link className="underline" href={`/invoice/${i.code}`} target="_blank">খুলুন / প্রিন্ট</Link></td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
