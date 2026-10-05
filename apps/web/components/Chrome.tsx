'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Customer site chrome (top bar, header, footer, mobile bottom nav). Hidden in the admin panel and on print pages. */
export function Chrome({ top, header, footer, children }: { top: React.ReactNode; header: React.ReactNode; footer: React.ReactNode; children: React.ReactNode }) {
  const path = usePathname() ?? '/';
  const bare = path.startsWith('/admin') || path.startsWith('/invoice/');
  if (bare) return <main className="flex-1">{children}</main>;
  return (
    <>
      {top}
      {header}
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
      {footer}
      <BottomNav path={path} />
    </>
  );
}

const TABS = [
  ['/', '🏠', 'হোম'],
  ['/search?q=trending', '🔍', 'খুঁজুন'],
  ['/ship', '🚚', 'শিপিং'],
  ['/cart', '🛒', 'কার্ট'],
  ['/account', '👤', 'অ্যাকাউন্ট'],
] as const;

function BottomNav({ path }: { path: string }) {
  return (
    <nav aria-label="মোবাইল মেনু" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#C9A447] bg-navy pb-[env(safe-area-inset-bottom)] md:hidden">
      {TABS.map(([href, icon, label]) => {
        const active = href === '/' ? path === '/' : path.startsWith(href.split('?')[0]);
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[12px] font-semibold ${active ? 'text-gold-light' : 'text-[#C8D3EA]'}`}>
            <span className="text-lg leading-none" aria-hidden="true">{icon}</span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
