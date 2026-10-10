'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export interface Slide { image: string; title?: string; link?: string }

/** Hero box: the tagline stays on top while the admin's hero banners fade underneath it. */
export function HeroSlider({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (slides.length < 2 || paused || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length, paused]);
  const current = slides[i];

  return (
    <section
      className="relative isolate flex min-h-[260px] w-full overflow-hidden rounded-3xl bg-gradient-to-br from-[#1A3C8A] to-[#0A1F52] text-white shadow-card md:min-h-[340px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      {slides.map((s, n) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={s.image + n} src={s.image} alt="" aria-hidden={n !== i} loading={n ? 'lazy' : 'eager'} className={`absolute inset-0 -z-10 h-full w-full object-cover transition-opacity duration-700 ${n === i ? 'opacity-100' : 'opacity-0'}`} />
      ))}
      {!!slides.length && <span className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0A1F52]/95 via-[#0A1F52]/70 to-[#0A1F52]/10" aria-hidden="true" />}
      <div className="flex max-w-2xl flex-col justify-center p-6 md:p-10">
        <span className="chip w-fit bg-white/10 text-gold-light backdrop-blur">সরাসরি চীনের কারখানা ও মূল সেলার থেকে</span>
        <h1 className="mt-3 text-3xl font-bold leading-tight drop-shadow md:text-5xl">
          চীনের বাজার থেকে <span className="text-gold">আপনার দুয়ারে।</span>
        </h1>
        <p className="mt-3 max-w-xl text-[#DCE4F4] md:text-lg">যেকোনো পণ্য, বাংলা টাকায় লাইভ দাম, অল্প পরিমাণেও অর্ডার। Air-এ ৭–১৫ দিন, Sea-তে ৪৫–৬৫ দিন।</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {current?.link ? (
            <Link href={current.link} className="btn-gold">{current.title || 'অফার দেখুন'}</Link>
          ) : (
            <Link href="/search?q=trending" className="btn-gold">পণ্য খুঁজুন</Link>
          )}
          <Link href="/ship" className="btn border border-white/40 text-white hover:border-gold hover:bg-white/10">শিপিং সার্ভিস</Link>
        </div>
      </div>
      {slides.length > 1 && (
        <div className="absolute bottom-3 right-4 flex gap-1.5">
          {slides.map((_, n) => (
            <button key={n} onClick={() => setI(n)} aria-label={`ব্যানার ${n + 1}`} aria-current={n === i} className={`h-2.5 rounded-full transition-all ${n === i ? 'w-6 bg-gold' : 'w-2.5 bg-white/50 hover:bg-white'}`} />
          ))}
        </div>
      )}
    </section>
  );
}
