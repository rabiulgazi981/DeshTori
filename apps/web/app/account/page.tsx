'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatBdt } from '@deshtori/shared';
import { api, ApiError, errText } from '@/lib/api';
import type { Me } from '@/lib/types';

interface OrderRow { code: string; createdAt: string; statusBn: string; shipMode: string; advancePct: number; images: (string | null)[]; bill: { total: number; paid: number; due: number } }

export default function AccountPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [m, o] = await Promise.all([api<{ user: Me }>('/auth/me'), api<OrderRow[]>('/orders')]);
        setMe(m.user);
        setOrders(o);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) router.push('/login?next=/account');
        else setErr(errText(e));
      }
    })();
  }, [router]);

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.push('/login');
  };

  if (!me) return <div className="mx-auto max-w-[1280px] p-6">{err ?? 'লোড হচ্ছে…'}</div>;
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-3 py-5 md:px-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-navy text-xl font-bold text-gold-light">{(me.name ?? '?').charAt(0)}</span>
          <span className="flex flex-col"><b className="text-lg">{me.name}</b><span className="text-sm text-muted">{me.phone} · {me.customerCode}</span></span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl bg-navy p-4 text-white"><span className="text-sm text-[#C8D3EA]">ওয়ালেট ব্যালেন্স</span><b className="text-3xl text-gold-light">{formatBdt(me.walletPaisa)}</b></div>
        <div className="card flex items-center justify-between gap-3 p-4"><span>অ্যাকাউন্ট ম্যানেজার: <b>01938-27 38 78</b></span><button onClick={logout} className="btn-outline">লগআউট</button></div>
      </div>
      <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="অ্যাকাউন্ট মেনু">
        {[['/ship', '🚚', 'আমার শিপিং পার্সেল'], ['/account/wallet', '💰', 'ওয়ালেট ও উত্তোলন'], ['/account/invoices', '🧾', 'ইনভয়েস'], ['/support', '💬', 'সাপোর্ট টিকেট'], ['/wishlist', '♡', 'উইশলিস্ট'], ['/account/addresses', '📍', 'ঠিকানা'], ['/account/profile', '⚙️', 'প্রোফাইল ও নোটিফিকেশন']].map(([href, icon, label]) => (
          <Link key={href} href={href} className="card flex min-h-[56px] items-center gap-2 px-3 py-2 text-sm font-semibold"><span aria-hidden="true">{icon}</span>{label}</Link>
        ))}
      </nav>
      <section className="card flex flex-col gap-3 p-4">
        <h1 className="text-xl font-bold">আমার অর্ডার</h1>
        <div className="overflow-x-auto rounded-xl border border-ivory-line">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="bg-navy text-left text-white"><tr>{['অর্ডার', 'তারিখ', 'পণ্য', 'শিপিং', 'অ্যাডভান্স', 'মোট', 'পরিশোধিত', 'বাকি', 'অবস্থা'].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.code} className="border-t border-ivory-line">
                  <td className="p-3 font-bold"><Link href={`/account/orders/${o.code}`} className="underline">{o.code}</Link></td>
                  <td className="p-3">{new Date(o.createdAt).toLocaleDateString('bn-BD')}</td>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <td className="p-3"><span className="flex gap-1">{o.images.filter(Boolean).slice(0, 2).map((src) => <img key={src!} src={src!} alt="" className="h-9 w-9 rounded-lg object-cover" />)}</span></td>
                  <td className="p-3">{o.shipMode === 'AIR' ? 'Air' : 'Sea'}</td>
                  <td className="p-3">{o.advancePct}%</td>
                  <td className="p-3">{formatBdt(o.bill.total)}</td>
                  <td className="p-3">{formatBdt(o.bill.paid)}</td>
                  <td className="p-3 font-bold">{formatBdt(o.bill.due)}</td>
                  <td className="p-3"><span className="chip bg-gold-chip text-gold-ink">{o.statusBn}</span></td>
                </tr>
              ))}
              {!orders.length && <tr><td colSpan={9} className="p-6 text-center text-muted">এখনো কোনো অর্ডার নেই</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
