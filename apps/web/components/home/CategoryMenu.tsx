'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Category } from '@/lib/content';
import { categoryHref } from '@/lib/categories';
import { rememberSearch } from '@/lib/recent';
import { ChevronDown, ChevronRight, GridIcon } from '../Icons';

type Cat = Category & { icon?: string };

const Icon = ({ c }: { c: Cat }) =>
  // eslint-disable-next-line @next/next/no-img-element
  c.image ? <img src={c.image} alt="" className="h-6 w-6 rounded object-cover" /> : <span className="w-6 text-center text-lg" aria-hidden="true">{c.icon ?? '🛍'}</span>;

/** Desktop: category list beside the hero. Mobile: a "সব ক্যাটাগরি" dropdown button. */
export function CategoryMenu({ categories }: { categories: Cat[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  return (
    <>
      <nav aria-label="ক্যাটাগরি" className="card hidden w-60 flex-none flex-col overflow-hidden lg:flex">
        <div className="flex items-center gap-2 bg-navy px-4 py-3 font-bold text-white"><GridIcon className="h-5 w-5 text-gold" />সব ক্যাটাগরি</div>
        <ul className="flex flex-col py-1">
          {categories.map((c) => (
            <li key={c.name}>
              <Link href={categoryHref(c)} onClick={() => rememberSearch(c.query || c.name || '')} className="group flex items-center gap-3 px-4 py-2 text-[15px] font-medium transition hover:bg-gold-chip hover:pl-5 active:bg-gold/30">
                <Icon c={c} />
                <span className="flex-1">{c.name}</span>
                <ChevronRight className="h-4 w-4 opacity-0 transition group-hover:opacity-60" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div ref={ref} className="relative lg:hidden">
        <button onClick={() => setOpen(!open)} aria-expanded={open} className="btn-navy w-full justify-between">
          <span className="flex items-center gap-2"><GridIcon className="h-5 w-5 text-gold" />সব ক্যাটাগরি</span>
          <ChevronDown className={`h-5 w-5 transition ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <ul className="card dt-pop absolute inset-x-0 top-[calc(100%+6px)] z-20 grid max-h-[60vh] grid-cols-2 overflow-auto p-1.5">
            {categories.map((c) => (
              <li key={c.name}>
                <Link href={categoryHref(c)} onClick={() => { rememberSearch(c.query || c.name || ''); setOpen(false); }} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-gold-chip active:bg-gold/30">
                  <Icon c={c} />
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
