'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { CameraIcon, CartIcon, HeartIcon, SearchIcon, TruckIcon, UserIcon } from './Icons';
import { DEFAULT_CATEGORIES } from '@/lib/categories';
import { recentSearches, rememberSearch } from '@/lib/recent';
import { setPendingImage } from '@/lib/pendingImage';

const isProductLink = (s: string) => /1688\.com|taobao\.com|tmall\.com/.test(s);
const FIRST = 'Search your any product — যা আপনার প্রয়োজন';

/** Placeholder that types itself out: the intro line, then the customer's recent searches, then categories. Hint only. */
function useTypingPlaceholder(paused: boolean) {
  const [text, setText] = useState(FIRST);
  useEffect(() => {
    if (paused || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const phrases = [FIRST, ...recentSearches().map((q) => `যেমন: ${q}`), ...DEFAULT_CATEGORIES.map((c) => `যেমন: ${c.name}`)];
    let i = 0;
    let n = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const p = phrases[i % phrases.length];
      if (!deleting) {
        n++;
        setText(p.slice(0, n));
        if (n >= p.length) {
          deleting = true;
          timer = setTimeout(tick, i === 0 ? 2600 : 1600);
          return;
        }
        timer = setTimeout(tick, 45);
      } else {
        n--;
        setText(p.slice(0, n));
        if (n <= 0) {
          deleting = false;
          i++;
        }
        timer = setTimeout(tick, 18);
      }
    };
    setText('');
    timer = setTimeout(tick, 400);
    return () => clearTimeout(timer);
  }, [paused]);
  return text || ' ';
}

const iconBtn = 'flex h-11 w-11 items-center justify-center rounded-xl bg-ivory text-navy shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-gold active:translate-y-0 active:scale-95 md:h-12 md:w-12';

export function Header({ logo = '/brand/logo-header.png', showImageSearch = true, showShipping = true }: { logo?: string; showImageSearch?: boolean; showShipping?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);
  const placeholder = useTypingPlaceholder(focused || !!q);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    if (isProductLink(v)) return router.push(`/link?url=${encodeURIComponent(v)}`);
    rememberSearch(v);
    router.push(`/search?q=${encodeURIComponent(v)}`);
  };

  return (
    <header className="relative top-0 z-30 border-b border-[#C9A447] bg-gradient-to-b from-[#16367F] to-[#0B2259] md:sticky">
      <div className="flex flex-wrap items-center gap-2.5 px-3 py-2.5 md:gap-5 md:px-5 md:py-3">
        <Link href="/" aria-label="DeshTori হোম" className="flex-none transition hover:opacity-90">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="DeshTori" className="block h-[42px] w-auto drop-shadow md:h-[62px]" />
        </Link>
        <form onSubmit={submit} role="search" className="order-3 flex w-full min-w-0 gap-2.5 md:order-none md:w-auto md:flex-1">
          <div className="flex min-w-0 flex-1 items-center overflow-hidden rounded-xl border-2 border-transparent bg-ivory shadow-inner transition focus-within:border-gold">
            <SearchIcon className="ml-3.5 h-5 w-5 flex-none text-navy/50" />
            <label htmlFor="q" className="sr-only">পণ্য খুঁজুন</label>
            <input
              id="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              type="search"
              placeholder={focused ? 'পণ্যের নাম বা 1688/Taobao লিংক দিন' : placeholder}
              className="min-w-0 flex-1 bg-transparent px-3 py-3 text-[15px] text-navy outline-none placeholder:text-navy/55"
            />
            <button type="submit" className="btn-gold h-12 rounded-none rounded-r-[10px] px-4 text-[15px] md:px-6">
              <SearchIcon className="h-5 w-5" />
              <span className="hidden sm:inline">খুঁজুন</span>
            </button>
          </div>
          {showImageSearch && (
            <label aria-label="ছবি দিয়ে খুঁজুন" title="ছবি দিয়ে খুঁজুন" className={`${iconBtn} h-12 w-12 flex-none cursor-pointer`}>
              <CameraIcon className="dt-snap h-6 w-6" />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  setPendingImage(f);
                  router.push('/image-search');
                }}
              />
            </label>
          )}
        </form>
        <nav aria-label="অ্যাকাউন্ট" className="ml-auto flex gap-1.5 md:gap-2.5">
          {showShipping && (
            <Link href="/ship" className="btn-gold h-11 px-3 text-[15px] md:h-12 md:px-4">
              <TruckIcon className="dt-drive h-5 w-5" />
              শিপিং
            </Link>
          )}
          <Link href="/cart" aria-label="কার্ট" title="কার্ট" className={iconBtn}><CartIcon className="h-6 w-6" /></Link>
          <Link href="/wishlist" aria-label="উইশলিস্ট" title="উইশলিস্ট" className={`${iconBtn} hidden sm:flex`}><HeartIcon className="h-6 w-6" /></Link>
          <Link href="/account" aria-label="আমার অ্যাকাউন্ট" title="আমার অ্যাকাউন্ট" className="btn-navy h-11 w-11 border border-white/20 px-0 md:h-12 md:w-12"><UserIcon className="h-6 w-6" /></Link>
        </nav>
      </div>
    </header>
  );
}
