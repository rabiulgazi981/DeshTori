import Link from 'next/link';
import { API_URL } from '@/lib/api';
import type { SearchItem } from '@/lib/types';
import { ProductCard } from '@/components/ProductCard';
import { Videos } from '@/components/Videos';
import { Popup } from '@/components/Popup';
import { getContent, type Banner, type Campaign, type Category, type Popup as PopupT, type Service, type Video } from '@/lib/content';

const CATEGORIES = [
  ['Shoes', 'জুতা'], ['Bags', 'ব্যাগ'], ['Jewelry', 'জুয়েলারি'], ['Beauty', 'বিউটি'], ['Men Clothing', 'ছেলেদের পোশাক'], ['Women Clothing', 'মেয়েদের পোশাক'],
  ['Baby Items', 'শিশু'], ['Phone Accessories', 'ফোন এক্সেসরিজ'], ['Electronics', 'ইলেকট্রনিক্স'], ['Home & Kitchen', 'ঘর ও রান্নাঘর'], ['Watches', 'ঘড়ি'], ['Sports', 'খেলাধুলা'],
];

async function trending(): Promise<SearchItem[]> {
  try {
    const r = await fetch(`${API_URL}/products/search?q=${encodeURIComponent('trending')}`, { next: { revalidate: 600 } });
    return r.ok ? (await r.json()).items : [];
  } catch {
    return [];
  }
}

const DEFAULT_SERVICES: Service[] = [
  { icon: '🛍', title: 'আমরা কিনে দিই', text: '1688/Taobao থেকে আপনার হয়ে কিনে, চেক করে পাঠাই।' },
  { icon: '🚚', title: 'শুধু শিপিং', text: 'নিজে কিনেছেন? আমাদের চায়না গুদামে পাঠান, আমরা দেশে আনব।' },
  { icon: '✈️', title: 'Air ৭–১৫ দিন', text: 'গুয়াংজু ও হংকং থেকে নিয়মিত ফ্লাইট।' },
  { icon: '🚢', title: 'Sea ৪৫–৬৫ দিন', text: 'ভারী ও বেশি পণ্যে কম খরচে।' },
];

export default async function Home() {
  const [items, banners, videos, cats, services, popup, campaign] = await Promise.all([
    trending(),
    getContent<Banner[]>('banners'),
    getContent<Video[]>('videos'),
    getContent<Category[]>('categories'),
    getContent<Service[]>('services'),
    getContent<PopupT>('popup'),
    getContent<Campaign>('campaign'),
  ]);
  const categories: Category[] = cats?.length ? cats : CATEGORIES.map(([en, bn]) => ({ name: bn, query: en }));
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-3 py-5 md:px-6">
      <Popup p={popup} />
      {campaign?.on && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-gold bg-gold-chip p-4 text-gold-ink">
          <div><b className="text-lg">{campaign.title}</b>{campaign.text && <p className="text-sm">{campaign.text}</p>}</div>
          {campaign.couponCode && <span className="rounded-xl bg-white px-4 py-2 font-bold tracking-wider text-navy">কোড: {campaign.couponCode}</span>}
        </section>
      )}
      {!!banners?.length && (
        <section className="flex snap-x snap-mandatory gap-3 overflow-x-auto rounded-3xl" aria-label="অফার">
          {banners.filter((b) => b.image).map((b, i) => (
            <a key={i} href={b.link || '#'} className="relative block w-full flex-none snap-center overflow-hidden rounded-3xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.image} alt={b.title ?? ''} className="block aspect-[3/1] w-full object-cover" loading={i ? 'lazy' : 'eager'} />
            </a>
          ))}
        </section>
      )}
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#1A3C8A] to-[#0A1F52] p-6 text-white md:p-10">
        <span className="chip bg-white/10 text-gold-light">1688 · Taobao · নিজস্ব চায়না টিম</span>
        <h1 className="mt-3 text-3xl font-bold leading-tight md:text-5xl">
          চীনের বাজার থেকে <span className="text-gold">আপনার দুয়ারে।</span>
        </h1>
        <p className="mt-3 max-w-xl text-[#C8D3EA] md:text-lg">যেকোনো পণ্য, বাংলা টাকায় লাইভ দাম, অল্প পরিমাণেও অর্ডার। Air-এ ৭–১৫ দিন, Sea-তে ৪৫–৬৫ দিন।</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/search?q=phone%20case" className="btn-gold">পণ্য খুঁজুন</Link>
          <Link href="/ship" className="btn border border-white/40 text-white">শিপিং সার্ভিস</Link>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 flex items-center gap-2.5 text-xl font-bold"><span className="h-5 w-1.5 rounded bg-gold" />ক্যাটাগরি</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {categories.map((c) => (
            <Link key={c.name} href={`/search?q=${encodeURIComponent(c.query || c.name || '')}`} className="flex flex-col items-center gap-2 rounded-xl bg-ivory p-3 text-center text-sm font-semibold hover:bg-ivory-soft">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {c.image ? <img src={c.image} alt="" className="aspect-square w-full rounded-lg object-cover" loading="lazy" /> : <span className="aspect-square w-full rounded-lg bg-ivory-ph" />}
              {c.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 flex items-center gap-2.5 text-xl font-bold"><span className="h-5 w-1.5 rounded bg-gold" />সবচেয়ে বেশি অর্ডার হওয়া পণ্য</h2>
        {items.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{items.map((p) => <ProductCard key={p.market + p.id} p={p} />)}</div>
        ) : (
          <p className="text-muted">এই মুহূর্তে পণ্য লোড করা যাচ্ছে না। API চালু আছে কিনা দেখুন।</p>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-4 flex items-center gap-2.5 text-xl font-bold"><span className="h-5 w-1.5 rounded bg-gold" />আমাদের সেবা</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(services?.length ? services : DEFAULT_SERVICES).map((sv) => (
            <div key={sv.title} className="flex flex-col gap-1 rounded-2xl bg-ivory p-4">
              <span className="text-3xl" aria-hidden="true">{sv.icon}</span>
              <b>{sv.title}</b>
              <p className="text-sm text-muted">{sv.text}</p>
            </div>
          ))}
        </div>
      </section>

      {!!videos?.length && (
        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2.5 text-xl font-bold"><span className="h-5 w-1.5 rounded bg-gold" />ভিডিও — কীভাবে অর্ডার করবেন</h2>
          <Videos items={videos} />
        </section>
      )}
    </div>
  );
}
