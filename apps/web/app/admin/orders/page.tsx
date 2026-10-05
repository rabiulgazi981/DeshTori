'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ORDER_STATUSES, STATUS_LABEL_BN, TRANSITIONS, type OrderStatus } from '@deshtori/shared';
import { api } from '@/lib/api';
import { Empty, Msg, PageHead, Pill, Table, d, tk, useAction, useApi } from '@/components/admin/ui';

interface Row {
  code: string; status: OrderStatus; createdAt: string; shipMode: string; payNowPaisa: number; paidPaisa: number; subtotalPaisa: number;
  user: { name: string | null; phone: string; customerCode: string | null };
  items: { title: string; image: string | null; qty: number }[];
}

function Orders() {
  const sp = useSearchParams();
  const [status, setStatus] = useState<string>(sp.get('status') ?? '');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [to, setTo] = useState<OrderStatus | ''>('');
  const { data, err, reload } = useApi<Row[]>(`/admin/orders${status ? `?status=${status}` : ''}`);
  const act = useAction();

  const rows = (data ?? []).filter((o) => !q || `${o.code} ${o.user.phone} ${o.user.name ?? ''} ${o.user.customerCode ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  const selStatuses = new Set(rows.filter((r) => sel.includes(r.code)).map((r) => r.status));
  const nextOptions = selStatuses.size === 1 ? TRANSITIONS[[...selStatuses][0]] : [];

  const bulk = async () => {
    if (!to) return;
    const r = await act.run(() => api<{ done: string[]; failed: { code: string }[] }>('/admin/orders/bulk-status', { method: 'POST', json: { codes: sel, status: to } }));
    if (r) act.setMsg({ ok: !r.failed.length, text: `${r.done.length}টি আপডেট হয়েছে${r.failed.length ? `, ${r.failed.length}টি হয়নি` : ''}` });
    setSel([]);
    setTo('');
    void reload();
  };

  return (
    <>
      <PageHead title="অর্ডার">
        <input className="input w-64" placeholder="কোড / ফোন / নাম" value={q} onChange={(e) => setQ(e.target.value)} />
      </PageHead>
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="tablist">
        {['', ...ORDER_STATUSES].map((s) => (
          <button key={s || 'all'} role="tab" aria-selected={status === s} onClick={() => { setStatus(s); setSel([]); }} className={`chip min-h-[36px] whitespace-nowrap border px-3 text-sm ${status === s ? 'border-navy bg-navy text-white' : 'border-ivory-line bg-white'}`}>
            {s ? STATUS_LABEL_BN[s as OrderStatus] : 'সব'}
          </button>
        ))}
      </div>
      {sel.length > 0 && (
        <div className="card mb-3 flex flex-wrap items-center gap-2 p-3">
          <b>{sel.length}টি বাছাই</b>
          {nextOptions.length ? (
            <>
              <select className="input w-auto" value={to} onChange={(e) => setTo(e.target.value as OrderStatus)}>
                <option value="">নতুন অবস্থা…</option>
                {nextOptions.map((s) => <option key={s} value={s}>{STATUS_LABEL_BN[s]}</option>)}
              </select>
              <button className="btn-gold" disabled={!to || act.busy} onClick={bulk}>একসাথে আপডেট</button>
            </>
          ) : (
            <span className="text-sm text-muted">একসাথে আপডেটের জন্য একই অবস্থার অর্ডার বাছাই করুন</span>
          )}
        </div>
      )}
      <Msg m={act.msg} />
      {err && <p className="text-danger">{err}</p>}
      {data && !rows.length ? <Empty /> : (
        <Table head={['', 'অর্ডার', 'তারিখ', 'গ্রাহক', 'পণ্য', 'শিপিং', 'পণ্যের দাম', 'অগ্রিম/পরিশোধ', 'অবস্থা']} min={900}>
          {rows.map((o) => (
            <tr key={o.code}>
              <td><input type="checkbox" aria-label={`${o.code} বাছাই`} className="h-5 w-5" checked={sel.includes(o.code)} onChange={(e) => setSel((v) => (e.target.checked ? [...v, o.code] : v.filter((x) => x !== o.code)))} /></td>
              <td><Link className="font-bold underline" href={`/admin/orders/${o.code}`}>{o.code}</Link></td>
              <td>{d(o.createdAt)}</td>
              <td>{o.user.name}<br /><span className="text-xs text-muted">{o.user.phone} · {o.user.customerCode}</span></td>
              <td className="max-w-[240px]"><span className="line-clamp-2">{o.items[0]?.title}</span>{o.items.length > 1 && <span className="text-xs text-muted"> +{o.items.length - 1}</span>}</td>
              <td>{o.shipMode === 'AIR' ? 'Air' : 'Sea'}</td>
              <td>{tk(o.subtotalPaisa)}</td>
              <td>{tk(o.payNowPaisa)} / <b>{tk(o.paidPaisa)}</b></td>
              <td><Pill s={o.status} label={STATUS_LABEL_BN[o.status]} /></td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}

export default function Page() {
  return <Suspense><Orders /></Suspense>;
}
