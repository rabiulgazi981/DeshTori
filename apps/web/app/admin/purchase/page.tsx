'use client';
import Link from 'next/link';
import { STATUS_LABEL_BN, type OrderStatus } from '@deshtori/shared';
import { Empty, PageHead, Panel, Pill, d, useApi } from '@/components/admin/ui';

interface O { code: string; status: OrderStatus; createdAt: string; shipMode: string; items: { id: string; title: string; image: string | null; sourceUrl: string; skuLabel: string; qty: number; unitFen: number; purchasedQty: number | null }[]; decisions: { id: string }[] }

export default function Purchase() {
  const { data, err } = useApi<O[]>('/admin/purchase-queue');
  return (
    <>
      <PageHead title="ক্রয় তালিকা (চায়না টিম)" />
      <p className="mb-3 text-sm text-muted">পুরনো অর্ডার আগে। প্রতিটি পণ্যের সাপ্লায়ার লিংক থেকে কিনে অর্ডার পেজে আসল দাম ও পরিমাণ লিখুন। সমস্যা হলে অর্ডার পেজ থেকে গ্রাহককে জিজ্ঞেস করুন।</p>
      {err && <p className="text-danger">{err}</p>}
      {data && !data.length && <Empty text="কেনার মতো কোনো অর্ডার নেই" />}
      <div className="grid gap-3 lg:grid-cols-2">
        {data?.map((o) => (
          <Panel key={o.code}>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/admin/orders/${o.code}`} className="text-lg font-bold underline">{o.code}</Link>
              <Pill s={o.status} label={STATUS_LABEL_BN[o.status]} />
              <span className="text-sm text-muted">{d(o.createdAt)} · {o.shipMode}</span>
              {o.decisions.length > 0 && <span className="chip bg-[#FBE9E6] text-danger">সিদ্ধান্তের অপেক্ষা</span>}
            </div>
            {o.items.map((i) => (
              <div key={i.id} className="flex gap-3 border-t border-ivory-line pt-2 text-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {i.image && <img src={i.image} alt="" className="h-14 w-14 flex-none rounded-lg object-cover" />}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 font-semibold">{i.title}</p>
                  <p>{i.skuLabel} · <b>{i.qty} পিস</b> · ¥{(i.unitFen / 100).toFixed(2)} {i.purchasedQty != null && <span className="text-emerald">· কেনা {i.purchasedQty}</span>}</p>
                  <a href={i.sourceUrl} target="_blank" rel="noreferrer" className="font-bold underline">সাপ্লায়ারে খুলুন ↗</a>
                </div>
              </div>
            ))}
          </Panel>
        ))}
      </div>
    </>
  );
}
