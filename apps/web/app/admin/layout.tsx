'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { can, MeCtx } from '@/components/admin/me';
import { api, ApiError } from '@/lib/api';
import type { Me } from '@/lib/types';

type Item = { href: string; label: string; icon: string; roles: string[] };
const ALL = ['BD_ORDER', 'CN_PURCHASE', 'CN_WAREHOUSE', 'SHIPMENT', 'BD_DELIVERY', 'ACCOUNTS'];
const NAV: { group: string; items: Item[] }[] = [
  { group: 'অপারেশন', items: [
    { href: '/admin', label: 'ড্যাশবোর্ড', icon: '📊', roles: ALL },
    { href: '/admin/orders', label: 'অর্ডার', icon: '📦', roles: ALL },
    { href: '/admin/payments', label: 'পেমেন্ট যাচাই', icon: '💳', roles: ['ACCOUNTS'] },
    { href: '/admin/purchase', label: 'ক্রয় (চায়না)', icon: '🛍', roles: ['CN_PURCHASE'] },
    { href: '/admin/ship-requests', label: 'শিপিং পার্সেল', icon: '📮', roles: ['CN_WAREHOUSE', 'SHIPMENT', 'BD_ORDER', 'BD_DELIVERY'] },
    { href: '/admin/shipments', label: 'শিপমেন্ট', icon: '✈️', roles: ['SHIPMENT', 'BD_DELIVERY', 'CN_WAREHOUSE'] },
    { href: '/admin/invoices', label: 'ইনভয়েস', icon: '🧾', roles: ['ACCOUNTS', 'BD_DELIVERY', 'BD_ORDER'] },
  ] },
  { group: 'গ্রাহক', items: [
    { href: '/admin/customers', label: 'গ্রাহক', icon: '👥', roles: ['BD_ORDER', 'ACCOUNTS', 'BD_DELIVERY'] },
    { href: '/admin/support', label: 'সাপোর্ট ও অভিযোগ', icon: '💬', roles: ['BD_ORDER', 'BD_DELIVERY', 'ACCOUNTS'] },
    { href: '/admin/abandoned', label: 'অসমাপ্ত কার্ট', icon: '🛒', roles: ['BD_ORDER'] },
    { href: '/admin/coupons', label: 'কুপন ও ক্যাম্পেইন', icon: '🎟', roles: ['BD_ORDER', 'ACCOUNTS'] },
  ] },
  { group: 'হিসাব', items: [{ href: '/admin/accounts', label: 'হিসাব ও উত্তোলন', icon: '📒', roles: ['ACCOUNTS'] }] },
  { group: 'সেটিংস', items: [
    { href: '/admin/content', label: 'ওয়েবসাইট কনটেন্ট', icon: '🖼', roles: ['OWNER'] },
    { href: '/admin/settings', label: 'রেট, নোটিশ ও নিষিদ্ধ', icon: '⚙️', roles: ['OWNER'] },
    { href: '/admin/staff', label: 'স্টাফ ও অডিট', icon: '🔐', roles: ['OWNER'] },
  ] },
];


export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname() ?? '/admin';
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    api<{ user: Me }>('/auth/me')
      .then((r) => (r.user.kind === 'STAFF' ? setMe(r.user) : setDenied(true)))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) router.replace('/login?next=/admin');
        else setDenied(true);
      });
  }, [router]);
  useEffect(() => setOpen(false), [path]);

  if (denied) return <div className="mx-auto max-w-md p-10 text-center"><p className="mb-4 text-lg font-bold">এই অংশ শুধু DeshTori স্টাফদের জন্য।</p><Link href="/" className="btn-gold">হোমে ফিরুন</Link></div>;
  if (!me) return <div className="p-10 text-center text-muted">লোড হচ্ছে…</div>;

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/login');
  };

  return (
    <MeCtx.Provider value={me}>
      <div className="flex min-h-screen bg-ivory">
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 overflow-y-auto bg-gradient-to-b from-[#16367F] to-[#0A1F52] p-3 text-[#C8D3EA] transition-transform md:static md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
          <Link href="/admin" className="mb-4 flex items-center gap-2 px-2 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-header.png" alt="DeshTori" className="h-10 w-auto" />
            <span className="text-xs font-bold text-gold-light">অ্যাডমিন</span>
          </Link>
          {NAV.map((g) => {
            const items = g.items.filter((i) => can(me, i.roles));
            if (!items.length) return null;
            return (
              <div key={g.group} className="mb-3">
                <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-gold-light/80">{g.group}</p>
                {items.map((i) => {
                  const active = i.href === '/admin' ? path === '/admin' : path.startsWith(i.href);
                  return (
                    <Link key={i.href} href={i.href} aria-current={active ? 'page' : undefined} className={`flex min-h-[42px] items-center gap-2.5 rounded-lg px-2.5 text-[15px] ${active ? 'bg-white/15 font-bold text-white' : 'hover:bg-white/10'}`}>
                      <span aria-hidden="true">{i.icon}</span>
                      {i.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </aside>
        {open && <button aria-label="মেনু বন্ধ" className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setOpen(false)} />}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-ivory-line bg-white px-3 py-2 md:px-5">
            <button className="btn-outline h-10 min-h-0 px-3 md:hidden" onClick={() => setOpen(true)} aria-label="মেনু">☰</button>
            <span className="truncate text-sm text-muted">{me.name ?? me.phone} · {me.roles.join(', ')}</span>
            <Link href="/" className="ml-auto text-sm font-semibold underline">ওয়েবসাইট</Link>
            <button onClick={logout} className="btn-outline h-10 min-h-0 px-3 text-sm">লগআউট</button>
          </header>
          <div className="min-w-0 flex-1 p-3 md:p-6">{children}</div>
        </div>
      </div>
    </MeCtx.Provider>
  );
}
