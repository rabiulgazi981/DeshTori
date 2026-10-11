import type { Metadata } from 'next';
import { StaticPage } from '@/components/StaticPage';
import { OFFICE_ADDRESS, OFFICE_MAP_EMBED, OFFICE_MAP_LINK } from '@/lib/site';

export const metadata: Metadata = { title: 'আমাদের সম্পর্কে — DeshTori' };

/** Founder photo: drop an image in apps/web/public (e.g. /brand/founder.jpg) and set its path here. Empty = initials avatar. */
const FOUNDER_IMAGE = '';

const ABOUT = `DeshTori Door To Door — চীনের বাজার থেকে আপনার দুয়ারে।

আমরা আপনার অর্ডার কোনো মধ্যস্বত্বভোগীর কাছ থেকে নয় — সরাসরি চীনের মূল উৎস থেকে কিনি: কারখানা, গুদাম কিংবা মূল ফাস্ট সেলার। তারপর আমাদের চায়না টিম পণ্য চেক করে নিজস্ব গুদাম হয়ে Air ও Sea-তে বাংলাদেশে আপনার দুয়ারে পৌঁছে দেয়।

কীভাবে অর্ডার করবেন:
- সাধারণভাবে আমাদের সাথে যোগাযোগ করুন — ইনবক্স বা WhatsApp-এ পণ্যের ছবি পাঠান, আমরা দাম ও বিস্তারিত জানিয়ে কনফার্ম করে দেব।
- অথবা সাইটে বাংলা টাকায় লাইভ দাম দেখে সরাসরি অর্ডার করুন।
- নিজেই সাপ্লায়ার থেকে কিনছেন? পণ্যের বিস্তারিত আমাদের জানান, রেট ফিক্স করুন এবং শুধু শিপিং সেবা নিন।
- প্রয়োজনে অনুরোধ করলে চীনা সাপ্লায়ারকে পেমেন্ট করে দেওয়ার সেবাও আমরা দিই।

DeshTori — A Sister Concern of Quick Clear Door To Door Service.
ঠিকানা: ${OFFICE_ADDRESS}
ফোন: 01938-27 38 78 · ইমেইল: info@deshtori.com`;

const TECH = [
  ['🔌', 'API ইন্টিগ্রেশন', 'সাপ্লায়ার, পেমেন্ট ও কুরিয়ার সিস্টেমের সাথে নিরাপদ API সংযোগ।'],
  ['📦', 'ইনভেন্টরি ম্যানেজমেন্ট', 'চায়না ও বাংলাদেশ গুদামের পণ্য রিয়েল-টাইমে হিসাব।'],
  ['🚚', 'অটোমেটেড অর্ডার ও শিপমেন্ট', 'অর্ডার থেকে ডেলিভারি পর্যন্ত প্রতিটি ধাপ স্বয়ংক্রিয়ভাবে ট্র্যাক ও আপডেট।'],
  ['🛒', 'সোর্সিং টেকনোলজি', 'Alibaba, 1688, Taobao ও Amazon ধাঁচের মার্কেটপ্লেস থেকে পণ্য খোঁজা ও দাম আনার প্রযুক্তি।'],
  ['📊', 'ডেটা ও অ্যানালিটিক্স', 'দাম, চাহিদা ও শিপমেন্টের ডেটা বিশ্লেষণ করে সঠিক সিদ্ধান্ত।'],
  ['🏭', 'সাপ্লায়ার সোর্সিং সিস্টেম', 'যাচাই করা কারখানা ও মূল সেলার খুঁজে বের করার সিস্টেম।'],
] as const;

const outlineBtn =
  'btn border border-navy bg-white text-navy transition hover:bg-navy hover:text-white active:scale-[.97] dark:border-gold-light dark:bg-transparent dark:text-gold-light dark:hover:bg-gold-light dark:hover:text-navy';

export default function Page() {
  return (
    <StaticPage title="আমাদের সম্পর্কে" lead="চীনের মূল উৎস থেকে সরাসরি — আপনার দুয়ারে।" field="about" fallback={ABOUT}>
      <div className="mx-auto flex max-w-[880px] flex-col gap-6 px-4 pb-10 md:px-6">
        {/* Office map */}
        <section id="map" className="card scroll-mt-24 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 md:px-8">
            <div>
              <h2 className="flex items-center gap-2.5 text-xl font-bold md:text-[22px]"><span aria-hidden="true" className="h-5 w-1.5 rounded bg-gold" />আমাদের অফিস</h2>
              <p className="mt-1 text-[15px] text-muted dark:text-[#C8D3EA] md:text-base">📍 {OFFICE_ADDRESS}</p>
            </div>
            <a href={OFFICE_MAP_LINK} target="_blank" rel="noopener noreferrer" className="btn-gold hover:brightness-105 active:scale-[.97]">Google Map-এ দেখুন ↗</a>
          </div>
          <iframe
            title="DeshTori অফিসের ম্যাপ"
            src={OFFICE_MAP_EMBED}
            className="block h-[280px] w-full border-0 md:h-[360px]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </section>

        {/* Founder */}
        <section className="card flex flex-col items-center gap-5 p-6 text-center sm:flex-row sm:text-left md:p-8">
          {FOUNDER_IMAGE ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={FOUNDER_IMAGE} alt="Md Rabiul Gazi" className="h-28 w-28 shrink-0 rounded-full border-4 border-gold object-cover" />
          ) : (
            <span aria-hidden="true" className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-4 border-gold bg-navy font-brand text-3xl font-bold text-gold-light">RG</span>
          )}
          <div className="flex flex-col gap-2">
            <span className="chip w-fit self-center bg-gold-chip text-gold-ink sm:self-start">প্রতিষ্ঠাতা</span>
            <h2 className="text-2xl font-bold">Md Rabiul Gazi</h2>
            <p className="text-[16px] leading-relaxed text-muted dark:text-[#C8D3EA] md:text-[17px]">Founder, DeshTori — বাংলাদেশের উদ্যোক্তাদের জন্য চীন থেকে সহজ, স্বচ্ছ ও নির্ভরযোগ্য সোর্সিং ও শিপিং গড়ে তোলাই তাঁর লক্ষ্য।</p>
            <a href="https://rabiulgazi.me" target="_blank" rel="noopener noreferrer" className={`${outlineBtn} w-fit self-center sm:self-start`}>rabiulgazi.me ↗</a>
          </div>
        </section>

        {/* Technology partner */}
        <section className="overflow-hidden rounded-2xl border-2 border-gold bg-navy text-[#C8D3EA] shadow-card">
          <div className="flex flex-col gap-3 px-6 pb-5 pt-7 md:px-10 md:pt-9">
            <span className="chip w-fit bg-gold text-navy">টেকনোলজি পার্টনার</span>
            <h2 className="font-brand text-3xl font-bold text-gold-light md:text-4xl">BONGSHAL TECH</h2>
            <p className="text-[17px] leading-[1.85] md:text-[18px]">
              DeshTori-র পুরো প্রযুক্তিগত ভিত্তি তৈরি ও পরিচালনা করে আমাদের টেকনোলজি পার্টনার BONGSHAL TECH। ওয়েবসাইট, অ্যাপ থেকে শুরু করে পেছনের প্রতিটি সিস্টেম — সম্পূর্ণ টেকনিক্যাল সাপোর্ট তারাই দেয়, যাতে আপনার অর্ডার দ্রুত, নির্ভুল ও স্বচ্ছভাবে চীন থেকে আপনার দুয়ারে পৌঁছায়।
            </p>
          </div>
          <ul className="grid gap-3 px-6 pb-6 sm:grid-cols-2 md:px-10">
            {TECH.map(([icon, title, text]) => (
              <li key={title} className="flex gap-3 rounded-xl border border-gold-light/25 bg-white/5 p-4">
                <span aria-hidden="true" className="text-2xl">{icon}</span>
                <span><b className="block text-white">{title}</b><span className="text-[15px] leading-relaxed">{text}</span></span>
              </li>
            ))}
          </ul>
          <div className="px-6 pb-8 md:px-10">
            <a href="https://bongshaltech.com/" target="_blank" rel="noopener noreferrer" className="btn-gold hover:brightness-105 active:scale-[.97]">BONGSHAL TECH সাইট দেখুন ↗</a>
          </div>
        </section>
      </div>
    </StaticPage>
  );
}
