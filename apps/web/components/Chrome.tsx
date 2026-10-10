'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CartIcon, SearchIcon, TruckIcon, UserIcon } from './Icons';

const HomeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 11 9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></svg>
);

/** Customer site chrome (top bar, header, footer, mobile bottom nav). Hidden in the admin panel and on print pages. */
export function Chrome({ top, header, footer, children, showMobileNav = true, showShipping = true }: { top: React.ReactNode; header: React.ReactNode; footer: React.ReactNode; children: React.ReactNode; showMobileNav?: boolean; showShipping?: boolean }) {
  const path = usePathname() ?? '/';
  const bare = path.startsWith('/admin') || path.startsWith('/invoice/');
  if (bare) return <main className="flex-1">{children}</main>;
  return (
    <>
      {top}
      {header}
      <main className={`flex-1 ${showMobileNav ? 'pb-20 md:pb-0' : ''}`}>{children}</main>
      {footer}
      {showMobileNav && <BottomNav path={path} showShipping={showShipping} />}
    </>
  );
}

const TABS = [
  ['/', HomeIcon, 'হোম'],
  ['/search?q=trending', SearchIcon, 'খুঁজুন'],
  ['/ship', TruckIcon, 'শিপিং'],
  ['/cart', CartIcon, 'কার্ট'],
  ['/account', UserIcon, 'অ্যাকাউন্ট'],
] as const;

function BottomNav({ path, showShipping }: { path: string; showShipping: boolean }) {
  return (
    <nav aria-label="মোবাইল মেনু" className={`fixed inset-x-0 bottom-0 z-40 grid ${showShipping ? 'grid-cols-5' : 'grid-cols-4'} border-t border-[#C9A447] bg-navy pb-[env(safe-area-inset-bottom)] md:hidden`}>
      {TABS.filter(([href]) => showShipping || href !== '/ship').map(([href, Icon, label]) => {
        const active = href === '/' ? path === '/' : path.startsWith(href.split('?')[0]);
        return (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[12px] font-semibold transition active:scale-95 ${active ? 'text-gold-light' : 'text-[#C8D3EA] hover:text-white'}`}>
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
