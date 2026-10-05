'use client';
import Link from 'next/link';
import { formatBdt } from '@deshtori/shared';
import { useCustomer } from '@/components/useCustomer';

interface Inv {
  code: string; kind: string; status: string; createdAt: string; totalPaisa: number; paidPaisa: number; duePaisa: number; signatureCaption: string;
  lines: { orderCode: string; label: string; amount: number }[];
  customer: { name: string | null; phone: string; customerCode: string | null } | null;
  orders: { code: string; statusBn: string; shipMode: string; advancePct: number; deliveryMethod: string; addressSnapshot: { name?: string; phone?: string; line?: string; area?: string; district?: string }; items: { title: string; skuLabel: string; qty: number; unitPaisa: number; image: string | null }[] }[];
}
const KIND: Record<string, string> = { DELIVERY: 'ডেলিভারি ইনভয়েস', ADVANCE: 'অগ্রিম ইনভয়েস', SHIP_REQUEST: 'শিপিং ইনভয়েস', CUSTOM: 'ইনভয়েস' };

export default function InvoicePage({ params }: { params: { code: string } }) {
  const { data: inv, err } = useCustomer<Inv>(`/invoices/${params.code}`);
  if (!inv) return <div className="p-8 text-center">{err ?? 'লোড হচ্ছে…'}</div>;
  const addr = inv.orders[0]?.addressSnapshot;
  return (
    <div className="min-h-screen bg-ivory px-2 py-4 print:bg-white print:p-0">
      <div className="mx-auto mb-3 flex max-w-[820px] justify-between gap-2 print:hidden">
        <Link href="/account/invoices" className="btn-outline">← ফিরে যান</Link>
        <button className="btn-gold" onClick={() => window.print()}>🖨 প্রিন্ট / PDF</button>
      </div>
      <article className="mx-auto max-w-[820px] bg-white p-5 text-navy shadow-card print:max-w-none print:shadow-none md:p-9">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-4 border-gold pb-4">
          <div className="rounded-xl bg-navy p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-header.png" alt="DeshTori" className="h-14 w-auto" />
          </div>
          <div className="text-right text-sm">
            <h1 className="text-2xl font-bold">{KIND[inv.kind] ?? 'ইনভয়েস'}</h1>
            <p>নং: <b>{inv.code}</b></p>
            <p>তারিখ: {new Date(inv.createdAt).toLocaleDateString('bn-BD')}</p>
            <p className={`mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-bold ${inv.duePaisa > 0 ? 'bg-[#FBE9E6] text-danger' : 'bg-emerald-light text-emerald-dark'}`}>{inv.duePaisa > 0 ? 'বাকি আছে' : 'পরিশোধিত'}</p>
          </div>
        </header>
        <section className="grid gap-4 py-4 text-sm sm:grid-cols-2">
          <div>
            <h2 className="mb-1 font-bold text-gold-ink">বিক্রেতা</h2>
            <p className="font-bold">DeshTori Door To Door</p>
            <p>219 West Monipur, Barek Mollar Mor, 60 Feet Road, Mirpur-2, Dhaka-1216</p>
            <p>01938-27 38 78 · info@deshtori.com</p>
          </div>
          <div>
            <h2 className="mb-1 font-bold text-gold-ink">গ্রাহক</h2>
            <p className="font-bold">{inv.customer?.name} · মার্ক {inv.customer?.customerCode}</p>
            <p>{inv.customer?.phone}</p>
            {addr && <p>{addr.name}, {addr.phone}, {addr.line}, {addr.area}, {addr.district}</p>}
          </div>
        </section>
        {inv.orders.map((o) => (
          <section key={o.code} className="mb-4 break-inside-avoid">
            <h3 className="mb-1 font-bold">অর্ডার {o.code} · {o.shipMode === 'AIR' ? 'Air' : 'Sea'} · {o.statusBn}</h3>
            <table className="w-full border-collapse text-sm">
              <thead><tr className="bg-navy text-left text-white print:bg-navy"><th className="p-2">পণ্য</th><th className="p-2">ভ্যারিয়েন্ট</th><th className="p-2 text-right">পরিমাণ</th><th className="p-2 text-right">দর</th><th className="p-2 text-right">মোট</th></tr></thead>
              <tbody>
                {o.items.map((i, k) => (
                  <tr key={k} className="border-b border-ivory-line"><td className="p-2">{i.title}</td><td className="p-2">{i.skuLabel}</td><td className="p-2 text-right">{i.qty}</td><td className="p-2 text-right">{formatBdt(i.unitPaisa)}</td><td className="p-2 text-right">{formatBdt(i.unitPaisa * i.qty)}</td></tr>
                ))}
              </tbody>
            </table>
            <ul className="ml-auto mt-2 flex max-w-sm flex-col gap-0.5 text-sm">
              {inv.lines.filter((l) => l.orderCode === o.code).map((l, k) => <li key={k} className="flex justify-between gap-3"><span>{l.label}</span><span>{formatBdt(l.amount)}</span></li>)}
            </ul>
            <p className="mt-1 text-xs text-muted">পেমেন্ট প্ল্যান: {o.advancePct}% অগ্রিম{o.advancePct < 100 ? `, বাকি ${100 - o.advancePct}% পণ্য পৌঁছালে` : ''}</p>
          </section>
        ))}
        <section className="ml-auto flex max-w-sm flex-col gap-1 border-t-2 border-navy pt-2 text-base">
          <p className="flex justify-between"><span>সর্বমোট</span><b>{formatBdt(inv.totalPaisa)}</b></p>
          <p className="flex justify-between"><span>পরিশোধিত</span><span>{formatBdt(inv.paidPaisa)}</span></p>
          <p className={`flex justify-between text-lg font-bold ${inv.duePaisa > 0 ? 'text-danger' : 'text-emerald'}`}><span>বাকি</span><span>{formatBdt(inv.duePaisa)}</span></p>
        </section>
        <footer className="mt-10 flex flex-wrap items-end justify-between gap-6">
          <p className="max-w-sm text-xs text-muted">পণ্য বুঝে নেওয়ার সময় আনবক্সিং ভিডিও রাখুন। সমস্যা থাকলে ৪৮ ঘণ্টার মধ্যে deshtori.com/account থেকে অভিযোগ করুন।</p>
          <div className="flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/signature.png" alt="স্বাক্ষর" className="h-16 w-auto" />
            <span className="mt-1 border-t border-navy px-6 pt-1 text-sm font-semibold">{inv.signatureCaption}</span>
          </div>
        </footer>
      </article>
    </div>
  );
}
