'use client';
import { useEffect, useState } from 'react';
import { ChatIcon, CloseIcon } from '../Icons';

const WHATSAPP = 'https://wa.me/8801938273878';
const SHOW_MS = 10_000;

/** Messenger-style chat bubble on the homepage: pops up on every load, stays 10 seconds, then leaves. */
export function ChatBubble() {
  const [state, setState] = useState<'hidden' | 'shown' | 'open'>('hidden');
  useEffect(() => {
    const show = setTimeout(() => setState('shown'), 800);
    const hide = setTimeout(() => setState((s) => (s === 'shown' ? 'hidden' : s)), 800 + SHOW_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, []);
  if (state === 'hidden') return null;

  return (
    <div className="fixed bottom-24 right-4 z-40 flex flex-col items-end gap-2 md:bottom-6 md:right-6">
      {state === 'open' ? (
        <div className="card dt-pop w-72 overflow-hidden" role="dialog" aria-label="আমাদের সাথে কথা বলুন">
          <div className="flex items-center justify-between bg-navy px-4 py-3 text-white">
            <b>DeshTori সাপোর্ট</b>
            <button onClick={() => setState('hidden')} aria-label="বন্ধ করুন" className="rounded-lg p-1 transition hover:bg-white/10"><CloseIcon className="h-5 w-5" /></button>
          </div>
          <div className="flex flex-col gap-3 p-4 text-sm">
            <p className="rounded-2xl rounded-tl-sm bg-ivory px-3 py-2">আসসালামু আলাইকুম! পণ্যের ছবি বা লিংক পাঠান, আমরা দাম জানিয়ে দেবো। 😊</p>
            <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="btn bg-[#25D366] text-white">WhatsApp-এ চ্যাট করুন</a>
            <a href="tel:+8801938273878" className="btn-outline">কল করুন: 01938-273878</a>
          </div>
        </div>
      ) : (
        <div className="dt-pop flex items-center gap-2">
          <span className="card hidden px-3 py-2 text-sm font-semibold sm:block">কোনো প্রশ্ন? চ্যাট করুন 👋</span>
          <button onClick={() => setState('open')} aria-label="চ্যাট খুলুন" className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#2F7BFF] to-[#A033FF] text-white shadow-xl transition hover:scale-105 active:scale-95">
            <span className="absolute inset-0 animate-ping rounded-full bg-[#7A5CFF]/40" aria-hidden="true" />
            <ChatIcon className="relative h-7 w-7" />
          </button>
        </div>
      )}
    </div>
  );
}
