'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Empty, Msg, PageHead, Table, dt, useAction, useApi } from '@/components/admin/ui';

interface A { user: { id: string; name: string | null; phone: string }; items: number; lastAt: string }

export default function Abandoned() {
  const [hours, setHours] = useState('24');
  const { data, err } = useApi<A[]>(`/admin/abandoned-carts?hours=${hours}`);
  const act = useAction();
  return (
    <>
      <PageHead title="অসমাপ্ত কার্ট">
        <select className="input w-auto" value={hours} onChange={(e) => setHours(e.target.value)}>
          {[['3', '৩ ঘণ্টার বেশি'], ['24', '১ দিনের বেশি'], ['72', '৩ দিনের বেশি'], ['168', '৭ দিনের বেশি']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </PageHead>
      <Msg m={act.msg} />
      {err && <p className="text-danger">{err}</p>}
      {data && !data.length ? <Empty /> : (
        <Table head={['গ্রাহক', 'ফোন', 'পিস', 'শেষ পরিবর্তন', '']}>
          {data?.map((a) => (
            <tr key={a.user.id}>
              <td>{a.user.name}</td><td>{a.user.phone}</td><td>{a.items}</td><td>{dt(a.lastAt)}</td>
              <td className="whitespace-nowrap">
                <button className="btn-gold h-9 min-h-0 px-3 text-sm" disabled={act.busy} onClick={() => act.run(() => api(`/admin/abandoned-carts/${a.user.id}/remind`, { method: 'POST' }), 'SMS পাঠানো হয়েছে')}>SMS রিমাইন্ডার</button>{' '}
                <a className="btn-outline h-9 min-h-0 px-3 text-sm" href={`https://wa.me/${a.user.phone.replace('+', '')}?text=${encodeURIComponent('আসসালামু আলাইকুম, DeshTori থেকে বলছি। আপনার কার্টের পণ্যগুলো অর্ডার করতে কোনো সাহায্য লাগবে?')}`} target="_blank" rel="noreferrer">WhatsApp</a>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
