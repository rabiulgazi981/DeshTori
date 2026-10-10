'use client';
import { useEffect, useState } from 'react';
import type { PublicSettings } from '@/lib/types';

type Theme = 'light' | 'dark' | 'system';
type Lang = 'bn' | 'en';

/** English uses Google's page translator; the choice lives in its `googtrans` cookie. */
const readLang = (): Lang => (/(?:^|;\s*)googtrans=\/bn\/en/.test(document.cookie) ? 'en' : 'bn');
function setLang(l: Lang) {
  const host = location.hostname;
  const domains = ['', `; domain=${host}`, `; domain=.${host.replace(/^www\./, '')}`];
  for (const d of domains) document.cookie = l === 'en' ? `googtrans=/bn/en; path=/${d}` : `googtrans=; path=/; max-age=0${d}`;
  location.reload();
}
function loadTranslator() {
  if (document.getElementById('gt-script')) return;
  const w = window as unknown as { googleTranslateInit?: () => void; google?: { translate: { TranslateElement: new (o: object, id: string) => unknown } } };
  w.googleTranslateInit = () => w.google && new w.google.translate.TranslateElement({ pageLanguage: 'bn', includedLanguages: 'en', autoDisplay: false }, 'gt-el');
  const el = document.createElement('div');
  el.id = 'gt-el';
  el.style.display = 'none';
  document.body.appendChild(el);
  const s = document.createElement('script');
  s.id = 'gt-script';
  s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateInit';
  s.async = true;
  document.body.appendChild(s);
}
const SPEED = { slow: '45s', normal: '30s', fast: '18s' } as const;

export function TopBar({ notice }: { notice?: PublicSettings['notice'] }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [open, setOpen] = useState(false);
  const [lang, setLangState] = useState<Lang>('bn');

  useEffect(() => {
    try {
      setTheme((localStorage.getItem('dt-theme') as Theme) || 'light');
    } catch {
      /* storage blocked */
    }
    const l = readLang();
    setLangState(l);
    if (l === 'en') loadTranslator();
  }, []);

  const apply = (t: Theme) => {
    setTheme(t);
    setOpen(false);
    try {
      localStorage.setItem('dt-theme', t);
    } catch {
      /* ignore */
    }
    const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  };

  const text = notice?.textBn ?? 'বাংলাদেশে এই প্রথম DeshTori Door To Door Service দিচ্ছে সবচেয়ে সাশ্রয় ও স্বল্প মূল্যে Quickly China থেকে Bangladesh এ শিপমেন্ট।';
  const hotline = notice?.hotline ?? '01938-27 38 78';
  const msg = (
    <span>
      {text} &nbsp;হটলাইন:{' '}
      <a href={`tel:+88${hotline.replace(/[^\d]/g, '')}`} className="font-bold text-gold-light">
        {hotline}
      </a>
    </span>
  );

  return (
    <div className="bg-navy text-[13px] text-[#C8D3EA]">
      <div className="flex items-center gap-3 px-4 py-1.5 md:px-5">
        {notice?.on !== false && (
          <div className="dt-ticker min-w-0 flex-1 overflow-hidden" role="marquee" aria-label="নোটিশ" style={{ ['--dt-speed' as string]: SPEED[notice?.speed ?? 'normal'] }}>
            <div className="dt-track">
              {msg}
              <span aria-hidden="true">{msg}</span>
            </div>
          </div>
        )}
        <div className="ml-auto flex flex-none items-center gap-1" role="group" aria-label="ভাষা">
          {(
            [
              ['bn', 'বাংলা'],
              ['en', 'English'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => k !== lang && setLang(k)}
              aria-pressed={lang === k}
              translate="no"
              className={`notranslate rounded-lg px-3 py-0.5 text-[13px] font-bold transition active:scale-95 ${lang === k ? 'bg-gold text-navy shadow-gold' : 'border border-white/30 text-white hover:border-gold hover:bg-white/10'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-none">
          <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label="থিম বদলান" className="flex h-7 w-8 items-center justify-center rounded-lg border border-white/30 text-white transition hover:border-gold hover:bg-white/10 active:scale-95">
            {theme === 'dark' ? '☾' : theme === 'system' ? '🖥' : '☀'}
          </button>
          {open && (
            <div role="dialog" aria-label="থিম" className="absolute right-0 top-[calc(100%+10px)] z-50 w-[300px] max-w-[calc(100vw-24px)] rounded-2xl border border-[#2A3B66] bg-[#0E1A33] p-3 shadow-2xl">
              <div className="mb-2 text-xs font-semibold tracking-wider text-[#A9B6CC]">থিম</div>
              <div className="flex gap-1 rounded-xl border border-[#2A3B66] bg-[#16244A] p-1" role="radiogroup">
                {(
                  [
                    ['light', '☀ লাইট'],
                    ['dark', '☾ ডার্ক'],
                    ['system', '🖥 সিস্টেম'],
                  ] as const
                ).map(([k, label]) => (
                  <button key={k} role="radio" aria-checked={theme === k} onClick={() => apply(k)} className={`min-h-[44px] flex-1 rounded-lg text-[15px] font-semibold ${theme === k ? 'bg-[#0A1430] text-white' : 'text-[#A9B6CC]'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
