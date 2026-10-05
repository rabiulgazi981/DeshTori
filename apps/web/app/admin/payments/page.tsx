'use client';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Empty, Msg, PageHead, Table, dt, tk, useAction, useApi } from '@/components/admin/ui';

interface P { id: string; method: string; amount: number; trxId: string | null; fromNumber: string | null; screenshot: string | null; createdAt: string; order: { code: string; payNowPaisa: number } | null }

export default function Payments() {
  const { data, err, reload } = useApi<P[]>('/admin/payments/pending');
  const act = useAction();
  const verify = (id: string, ok: boolean) => act.run(async () => { await api(`/admin/payments/${id}/verify`, { method: 'POST', json: { ok } }); await reload(); }, ok ? 'পেমেন্ট গ্রহণ করা হয়েছে, গ্রাহক SMS পেয়েছেন' : 'বাতিল করা হয়েছে');
  return (
    <>
      <PageHead title="পেমেন্ট যাচাই" />
      <p className="mb-3 text-sm text-muted">bKash/Nagad/ব্যাংক স্টেটমেন্টে TrxID ও টাকা মিলিয়ে তারপর গ্রহণ করুন। অনলাইন গেটওয়ের পেমেন্ট নিজে থেকেই যাচাই হয়ে যায়।</p>
      <Msg m={act.msg} />
      {err && <p className="text-danger">{err}</p>}
      {data && !data.length ? <Empty text="যাচাইয়ের অপেক্ষায় কোনো পেমেন্ট নেই" /> : (
        <Table head={['সময়', 'অর্ডার', 'পদ্ধতি', 'TrxID', 'যে নম্বর থেকে', 'টাকা', 'স্ক্রিনশট', '']} min={900}>
          {data?.map((p) => (
            <tr key={p.id}>
              <td>{dt(p.createdAt)}</td>
              <td>{p.order ? <Link className="font-bold underline" href={`/admin/orders/${p.order.code}`}>{p.order.code}</Link> : '—'}</td>
              <td>{p.method.replace('MANUAL_', '')}</td>
              <td><code className="font-bold">{p.trxId}</code></td>
              <td>{p.fromNumber}</td>
              <td><b>{tk(p.amount)}</b>{p.order && p.amount !== p.order.payNowPaisa && <span className="block text-xs text-danger">প্রত্যাশিত {tk(p.order.payNowPaisa)}</span>}</td>
              <td>{p.screenshot ? <a href={p.screenshot} target="_blank" rel="noreferrer" className="underline">দেখুন</a> : '—'}</td>
              <td className="whitespace-nowrap">
                <button className="btn-gold h-9 min-h-0 px-3 text-sm" disabled={act.busy} onClick={() => verify(p.id, true)}>✓ গ্রহণ</button>{' '}
                <button className="btn-outline h-9 min-h-0 border-danger px-3 text-sm text-danger" disabled={act.busy} onClick={() => verify(p.id, false)}>✕ মেলেনি</button>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
