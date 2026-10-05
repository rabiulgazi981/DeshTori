import Link from 'next/link';
import { API_URL } from '@/lib/api';
import type { SearchItem } from '@/lib/types';
import { ProductCard } from '@/components/ProductCard';

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

export default async function Home() {
  const items = await trending();
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-3 py-5 md:px-6">
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
          {CATEGORIES.map(([en, bn]) => (
            <Link key={en} href={`/search?q=${encodeURIComponent(en)}`} className="flex flex-col items-center gap-2 rounded-xl bg-ivory p-3 text-center text-sm font-semibold hover:bg-ivory-soft">
              <span className="aspect-square w-full rounded-lg bg-ivory-ph" />
              {bn}
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
    </div>
  );
}
