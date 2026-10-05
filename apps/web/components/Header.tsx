'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

const isProductLink = (s: string) => /1688\.com|taobao\.com|tmall\.com/.test(s);

export function Header() {
  const router = useRouter();
  const [q, setQ] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    router.push(isProductLink(v) ? `/link?url=${encodeURIComponent(v)}` : `/search?q=${encodeURIComponent(v)}`);
  };

  return (
    <header className="relative top-0 z-30 border-b border-[#C9A447] bg-gradient-to-b from-[#16367F] to-[#0B2259] md:sticky">
      <div className="flex flex-wrap items-center gap-2.5 px-3 py-2.5 md:gap-5 md:px-5 md:py-3">
        <Link href="/" aria-label="DeshTori হোম" className="flex-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-header.png" alt="DeshTori" className="block h-[42px] w-auto drop-shadow md:h-[62px]" />
        </Link>
        <form onSubmit={submit} role="search" className="order-3 flex w-full min-w-0 gap-2.5 md:order-none md:w-auto md:flex-1">
          <div className="flex min-w-0 flex-1 items-center overflow-hidden rounded-xl border border-ivory-line bg-ivory">
            <label htmlFor="q" className="sr-only">পণ্য খুঁজুন</label>
            <input id="q" value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="পণ্যের নাম বা 1688/Taobao লিংক দিন" className="min-w-0 flex-1 bg-transparent px-4 py-3 text-[15px] text-navy outline-none" />
            <button type="submit" aria-label="খুঁজুন" className="btn-gold h-12 rounded-none rounded-r-xl px-4">⌕</button>
          </div>
          <Link href="/image-search" aria-label="ছবি দিয়ে খুঁজুন" className="btn-gold h-12 w-12 flex-none px-0">📷</Link>
        </form>
        <nav aria-label="অ্যাকাউন্ট" className="ml-auto flex gap-1.5 md:gap-2.5">
          <Link href="/ship" className="btn-gold h-11 px-3 text-[15px] md:h-12">🚚 শিপিং</Link>
          <Link href="/cart" aria-label="কার্ট" className="flex h-11 w-11 items-center justify-center rounded-xl bg-ivory text-xl md:h-12 md:w-12">🛒</Link>
          <Link href="/wishlist" aria-label="উইশলিস্ট" className="hidden h-12 w-12 items-center justify-center rounded-xl bg-ivory text-xl sm:flex">♡</Link>
          <Link href="/account" aria-label="আমার অ্যাকাউন্ট" className="btn-navy h-11 w-11 px-0 md:h-12 md:w-12">👤</Link>
        </nav>
      </div>
    </header>
  );
}
