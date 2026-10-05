'use client';
import Link from 'next/link';
import { STATUS_LABEL_BN, ORDER_STATUSES } from '@deshtori/shared';
import { PageHead, Panel, Pill, tk, useApi } from '@/components/admin/ui';

interface Dash {
  byStatus: Record<string, number>;
  todayOrders: number;
  pendingPayments: number;
  openTickets: number;
  openComplaints: number;
  awaitingShipRequests: number;
  customers: number;
  todayIncomePaisa: number;
  pendingDecisions: number;
}

export default function Dashboard() {
  const { data, err } = useApi<Dash>('/admin/dashboard');
  if (err) return <p className="text-danger">{err}</p>;
  if (!data) return <p className="text-muted">লোড হচ্ছে…</p>;
  const cards: [string, string | number, string][] = [
    ['আজকের অর্ডার', data.todayOrders, '/admin/orders'],
    ['আজকের আয়', tk(data.todayIncomePaisa), '/admin/accounts'],
    ['পেমেন্ট যাচাই বাকি', data.pendingPayments, '/admin/payments'],
    ['গ্রাহকের সিদ্ধান্ত বাকি', data.pendingDecisions, '/admin/orders?status=NEEDS_DECISION'],
    ['খোলা টিকেট', data.openTickets, '/admin/support'],
    ['অভিযোগ রিভিউ', data.openComplaints, '/admin/support'],
    ['পার্সেল আসার অপেক্ষায়', data.awaitingShipRequests, '/admin/ship-requests'],
    ['মোট গ্রাহক', data.customers, '/admin/customers'],
  ];
  return (
    <>
      <PageHead title="ড্যাশবোর্ড" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([label, v, href], i) => (
          <Link key={label} href={href} className={`flex flex-col gap-1 rounded-2xl p-4 ${i === 1 ? 'bg-navy text-white' : 'card'}`}>
            <span className={`text-sm ${i === 1 ? 'text-[#C8D3EA]' : 'text-muted'}`}>{label}</span>
            <b className={`text-2xl ${i === 1 ? 'text-gold-light' : ''}`}>{v}</b>
          </Link>
        ))}
      </div>
      <Panel title="অবস্থা অনুযায়ী অর্ডার" className="mt-4">
        <div className="flex flex-wrap gap-2">
          {ORDER_STATUSES.map((s) => (
            <Link key={s} href={`/admin/orders?status=${s}`} className="flex items-center gap-2 rounded-xl border border-ivory-line px-3 py-2">
              <Pill s={s} label={STATUS_LABEL_BN[s]} />
              <b>{data.byStatus[s] ?? 0}</b>
            </Link>
          ))}
        </div>
      </Panel>
    </>
  );
}
