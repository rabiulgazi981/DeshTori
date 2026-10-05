'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Empty, PageHead, Table, d, tk, useApi } from '@/components/admin/ui';

interface C { id: string; phone: string; name: string | null; customerCode: string | null; buyerType: string | null; walletPaisa: number; isBlocked: boolean; createdAt: string; _count: { orders: number } }

export default function Customers() {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const { data, err } = useApi<C[]>(`/admin/customers${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  return (
    <>
      <PageHead title="গ্রাহক">
        <form onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); }} className="flex gap-2">
          <input className="input w-64" placeholder="ফোন / নাম / DT-কোড" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn-navy">খুঁজুন</button>
        </form>
      </PageHead>
      {err && <p className="text-danger">{err}</p>}
      {data && !data.length ? <Empty /> : (
        <Table head={['মার্ক', 'নাম', 'ফোন', 'ধরন', 'অর্ডার', 'ওয়ালেট', 'যোগদান', '']}>
          {data?.map((c) => (
            <tr key={c.id}>
              <td className="font-bold">{c.customerCode}</td>
              <td>{c.name} {c.isBlocked && <span className="chip bg-[#FBE9E6] text-danger">ব্লকড</span>}</td>
              <td>{c.phone}</td><td>{c.buyerType ?? '—'}</td><td>{c._count.orders}</td><td>{tk(c.walletPaisa)}</td><td>{d(c.createdAt)}</td>
              <td><Link className="underline" href={`/admin/customers/${c.id}`}>বিস্তারিত</Link></td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
