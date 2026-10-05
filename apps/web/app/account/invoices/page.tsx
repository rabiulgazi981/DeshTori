'use client';
import Link from 'next/link';
import { formatBdt } from '@deshtori/shared';
import { useCustomer } from '@/components/useCustomer';

interface I { id: string; code: string; kind: string; totalPaisa: number; paidPaisa: number; status: string; createdAt: string }

export default function Invoices() {
  const { data, err } = useCustomer<I[]>('/invoices');
  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-4 px-3 py-5 md:px-6">
      <Link href="/account" className="text-sm underline">← অ্যাকাউন্ট</Link>
      <h1 className="text-2xl font-bold">ইনভয়েস</h1>
      {err && <p className="text-danger">{err}</p>}
      {data && !data.length && <p className="card p-6 text-center text-muted">এখনো কোনো ইনভয়েস নেই</p>}
      {data?.map((i) => (
        <Link key={i.id} href={`/invoice/${i.code}`} className="card flex flex-wrap items-center justify-between gap-2 p-4">
          <span><b>{i.code}</b> <span className="text-sm text-muted">{new Date(i.createdAt).toLocaleDateString('bn-BD')}</span></span>
          <span>মোট {formatBdt(i.totalPaisa)} · বাকি <b className={i.totalPaisa - i.paidPaisa > 0 ? 'text-danger' : 'text-emerald'}>{formatBdt(i.totalPaisa - i.paidPaisa)}</b></span>
        </Link>
      ))}
    </div>
  );
}
