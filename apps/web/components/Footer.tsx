'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { OFFICE_ADDRESS } from '@/lib/site';

const COLUMNS: { title: string; links: [href: string, label: string][] }[] = [
  {
    title: 'সাহায্য',
    links: [
      ['/account', 'অর্ডার ট্র্যাক'],
      ['/rates', 'শিপিং রেট'],
      ['/rates#banned', 'নিষিদ্ধ পণ্য'],
      ['/refund-policy', 'রিফান্ড নীতি'],
      ['/support', 'সাপোর্ট'],
    ],
  },
  {
    title: 'কোম্পানি',
    links: [
      ['/about', 'আমাদের সম্পর্কে'],
      ['/blog', 'ব্লগ'],
      ['/terms', 'শর্তাবলি'],
      ['/privacy', 'প্রাইভেসি নীতি'],
    ],
  },
];

const PAYMENTS: { name: string; cls: string }[] = [
  { name: 'bKash', cls: 'bg-white text-navy' },
  { name: 'Nagad', cls: 'bg-white text-danger' },
  { name: 'VISA', cls: 'bg-white italic tracking-wider text-navy' },
  { name: 'Mastercard', cls: 'bg-white text-navy' },
  { name: 'ব্যাংক ট্রান্সফার', cls: 'bg-gold-chip text-gold-ink' },
];

// Shared interaction styles: hover, keyboard focus, pressed and current-page states.
const linkBase =
  'group inline-flex w-fit items-center gap-1.5 rounded-md py-0.5 transition-colors duration-150 hover:text-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-light active:scale-[.97] active:text-gold';

function isActive(path: string, href: string) {
  const base = href.split('#')[0];
  if (href.includes('#')) return false; // anchors share the page with their parent link
  return base === '/' ? path === '/' : path === base || path.startsWith(`${base}/`);
}

function FooterLink({ href, label, path }: { href: string; label: string; path: string }) {
  const active = isActive(path, href);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`${linkBase} ${active ? 'font-bold text-gold-light' : 'text-[#C8D3EA]'}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full transition-all ${active ? 'bg-gold-light' : 'bg-transparent group-hover:bg-gold-light/70'}`} />
      {label}
    </Link>
  );
}

const iconBtn =
  'inline-flex h-10 w-10 items-center justify-center rounded-full border border-gold-light/40 text-lg transition hover:border-gold-light hover:bg-gold-light hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-light active:scale-90';

export function Footer({ logo = '/brand/logo-footer.png' }: { logo?: string }) {
  const path = usePathname() ?? '/';
  return (
    <footer className="mt-12 bg-navy text-[#C8D3EA]">
      <div className="mx-auto grid max-w-[1920px] gap-x-10 gap-y-8 px-4 pb-6 pt-10 sm:grid-cols-2 md:px-7 2xl:px-10 lg:grid-cols-[1.6fr_1fr_1fr_1.3fr]">
        {/* Brand + about */}
        <div className="flex flex-col gap-3">
          <Link href="/" aria-label="DeshTori হোম" className="w-fit rounded-md transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-light active:scale-[.98]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="DeshTori – চীনের বাজার থেকে আপনার দুয়ারে।" className="block h-auto w-full max-w-[300px]" />
          </Link>
          <p className="max-w-[380px] text-[14px] leading-relaxed">
            চীনের কারখানা, গুদাম ও মূল সেলার থেকে সরাসরি আপনার পণ্য কিনে, চেক করে Air ও Sea-তে বাংলাদেশে আপনার দুয়ারে পৌঁছে দিই।
          </p>
          <p className="text-[12px] text-[#C8D3EA]/80">A Sister Concern of Quick Clear Door To Door Service</p>
          <div className="mt-1 flex gap-2" aria-label="যোগাযোগ মাধ্যম">
            <a href="https://wa.me/8801938273878" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" title="WhatsApp" className={iconBtn}>💬</a>
            <a href="tel:+8801938273878" aria-label="ফোন করুন" title="ফোন করুন" className={iconBtn}>📞</a>
            <a href="mailto:info@deshtori.com" aria-label="ইমেইল" title="ইমেইল" className={iconBtn}>✉️</a>
          </div>
        </div>

        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title} className="flex flex-col gap-2 text-[15px]">
            <b className="mb-1 border-b border-gold-light/30 pb-2 text-white">{col.title}</b>
            {col.links.map(([href, label]) => <FooterLink key={href} href={href} label={label} path={path} />)}
          </nav>
        ))}

        {/* Contact */}
        <div className="flex flex-col gap-2 text-[15px]">
          <b className="mb-1 border-b border-gold-light/30 pb-2 text-white">যোগাযোগ</b>
          <a href="tel:+8801938273878" className={`${linkBase} text-[#C8D3EA]`}>📞 01938-27 38 78</a>
          <a href="mailto:info@deshtori.com" className={`${linkBase} text-[#C8D3EA]`}>✉️ info@deshtori.com</a>
          <Link href="/about#map" className={`${linkBase} items-start text-[#C8D3EA]`}>
            <span aria-hidden="true">📍</span>
            <span className="leading-relaxed">{OFFICE_ADDRESS}</span>
          </Link>
        </div>
      </div>

      {/* Payment methods banner */}
      <div className="mx-auto max-w-[1920px] px-4 pb-5 md:px-7 2xl:px-10">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-gold-light/30 bg-white/5 px-4 py-3">
          <span className="text-[13px] font-bold text-white">🔒 নিরাপদ পেমেন্ট:</span>
          <ul className="flex flex-wrap gap-2" aria-label="পেমেন্ট মাধ্যম">
            {PAYMENTS.map((p) => (
              <li key={p.name} className={`rounded-md px-2.5 py-1 text-[12px] font-extrabold shadow-sm ${p.cls}`}>{p.name}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-gold-light/30">
        <div className="mx-auto flex max-w-[1920px] flex-wrap items-center justify-between gap-2 px-4 py-4 text-[13px] md:px-7 2xl:px-10">
          <span>চীনের বাজার থেকে আপনার দুয়ারে।</span>
          <span>
            Design &amp; Development by{' '}
            <a href="https://bongshaltech.com/" target="_blank" rel="noopener noreferrer" className="font-bold text-gold-light underline-offset-2 transition hover:text-white hover:underline active:opacity-70">BONGSHAL TECH</a>
            {' '}· © 2026{' '}
            <a href="https://deshtori.com" target="_blank" rel="noopener noreferrer" className="font-bold text-white underline-offset-2 transition hover:text-gold-light hover:underline active:opacity-70">DeshTori</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
