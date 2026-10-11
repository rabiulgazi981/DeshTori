import Link from 'next/link';
import { API_URL } from '@/lib/api';
import type { SearchItem } from '@/lib/types';
import { Videos } from '@/components/Videos';
import { Popup } from '@/components/Popup';
import { HeroSlider } from '@/components/home/HeroSlider';
import { HideIfBroken } from '@/components/home/HideIfBroken';
import { CategoryMenu } from '@/components/home/CategoryMenu';
import { ProductTabs } from '@/components/home/ProductTabs';
import { ChatBubble } from '@/components/home/ChatBubble';
import { categoryHref, withCategoryDefaults } from '@/lib/categories';
import { getContent, type Banner, type Campaign, type Category, type Popup as PopupT, type Service, type Video } from '@/lib/content';

/** Banner fields the admin banner editor may add; older saved banners have none of them (= hero, active). */
type BannerX = Banner & { placement?: 'hero' | 'wide'; active?: boolean; order?: number; subtitle?: string; buttonText?: string; showButton?: boolean; width?: 'full' | 'contained' };

async function trending(): Promise<SearchItem[]> {
  try {
    const r = await fetch(`${API_URL}/products/search?q=${encodeURIComponent('trending')}`, { next: { revalidate: 600 } });
    return r.ok ? (await r.json()).items : [];
  } catch {
    return [];
  }
}

/** Categories without an admin-uploaded image get the photo of the top product for their search (cached for a day). */
async function withCategoryPhotos<T extends Category>(cats: T[]): Promise<T[]> {
  return Promise.all(
    cats.map(async (c) => {
      if (c.image) return c;
      try {
        const r = await fetch(`${API_URL}/products/search?q=${encodeURIComponent(c.query || c.name || '')}`, { next: { revalidate: 86400 } });
        const items: SearchItem[] = r.ok ? (await r.json()).items : [];
        const img = items.find((i) => i.image)?.image;
        return img ? { ...c, image: img } : c;
      } catch {
        return c;
      }
    }),
  );
}

const DEFAULT_SERVICES: (Service & { bg: string })[] = [
  { icon: '🏭', title: 'সরাসরি কারখানা থেকে কিনি', text: 'আপনার অর্ডার আমরা চীনের কারখানা, গুদাম বা মূল সেলারের কাছ থেকে সরাসরি কিনি। মাঝে কোনো দালাল নেই।', bg: '📦' },
  { icon: '🚚', title: 'শুধু শিপিং', text: 'নিজে কিনেছেন? আমাদের চায়না গুদামে পাঠান, আমরা দেশে আনব।', bg: '🚛' },
  { icon: '✈️', title: 'Air ৭–১৫ দিন', text: 'গুয়াংজু ও হংকং থেকে নিয়মিত ফ্লাইট।', bg: '✈️' },
  { icon: '🚢', title: 'Sea ৪৫–৬৫ দিন', text: 'ভারী ও বেশি পণ্যে কম খরচে।', bg: '🚢' },
];

export default async function Home() {
  const [items, banners, videos, cats, services, popup, campaign] = await Promise.all([
    trending(),
    getContent<BannerX[]>('banners'),
    getContent<Video[]>('videos'),
    getContent<Category[]>('categories'),
    getContent<Service[]>('services'),
    getContent<PopupT>('popup'),
    getContent<Campaign>('campaign'),
  ]);
  const categories = await withCategoryPhotos(withCategoryDefaults(cats));
  const live = (banners ?? []).filter((b) => b.image && b.active !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const hero = live.filter((b) => (b.placement ?? 'hero') === 'hero').map((b) => ({ image: b.image!, title: b.showButton === false ? undefined : b.buttonText || b.title, link: b.link }));
  const wide = live.filter((b) => b.placement === 'wide');
  const serviceCards = services?.length ? services.map((s, n) => ({ ...s, bg: DEFAULT_SERVICES[n % 4].bg })) : DEFAULT_SERVICES;

  return (
    <div className="mx-auto flex max-w-[1920px] flex-col gap-6 px-3 py-5 md:px-6 2xl:px-10">
      <Popup p={popup} />
      {campaign?.on && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-gold bg-gold-chip p-4 text-gold-ink">
          <div><b className="text-lg">{campaign.title}</b>{campaign.text && <p className="text-sm">{campaign.text}</p>}</div>
          {campaign.couponCode && <span className="rounded-xl bg-white px-4 py-2 font-bold tracking-wider text-navy">কোড: {campaign.couponCode}</span>}
        </section>
      )}

      <div className="flex flex-col gap-4 lg:h-[340px] lg:flex-row 2xl:h-[420px]">
        <CategoryMenu categories={categories} />
        <div className="flex min-w-0 flex-1"><HeroSlider slides={hero} /></div>
      </div>

      {wide.map((b, i) => {
        const img = (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.image} alt={b.title ?? ''} loading="lazy" className="block aspect-[5/1] min-h-[90px] w-full object-cover" />
        );
        return (
          <HideIfBroken key={i} src={b.image}>
          <section className={`group relative overflow-hidden shadow-card ${b.width === 'contained' ? 'rounded-3xl' : '-mx-3 md:-mx-6 2xl:-mx-10'}`} aria-label={b.title || 'অফার'}>
            {b.link ? <Link href={b.link} className="block transition group-hover:brightness-105">{img}</Link> : img}
            {(b.title || (b.showButton && b.link)) && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-between gap-3 bg-gradient-to-r from-black/40 to-transparent p-4 md:p-8">
                <div className="text-white drop-shadow">
                  {b.title && <b className="text-lg md:text-3xl">{b.title}</b>}
                  {b.subtitle && <p className="text-sm md:text-base">{b.subtitle}</p>}
                </div>
                {b.showButton && b.link && <span className="btn-gold pointer-events-auto">{b.buttonText || 'দেখুন'}</span>}
              </div>
            )}
          </section>
          </HideIfBroken>
        );
      })}

      <section className="card p-5">
        <h2 className="mb-4 flex items-center gap-2.5 text-xl font-bold"><span className="h-5 w-1.5 rounded bg-gold" />ক্যাটাগরি</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7 2xl:grid-cols-[repeat(auto-fill,minmax(120px,1fr))]">
          {categories.map((c) => (
            <Link key={c.name} href={categoryHref(c)} className="group flex flex-col overflow-hidden rounded-2xl border border-ivory-line bg-white text-center text-sm font-semibold shadow-card transition hover:-translate-y-1 hover:border-gold hover:shadow-gold active:translate-y-0 active:scale-95">
              <span className="relative block aspect-square overflow-hidden bg-ivory-ph">
                {c.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" />
                ) : (
                  <span className="dt-cat-art relative block h-full w-full" aria-hidden="true">
                    <span className="absolute inset-0 flex items-center justify-center pb-[8%] text-[64px] leading-none transition duration-300 group-hover:scale-110 md:text-[76px]">{c.icon}</span>
                    {[...(c.more ?? '')].filter((ch) => /\p{Extended_Pictographic}/u.test(ch)).slice(0, 2).map((e, n) => (
                      <span key={n} className={`absolute bottom-[6%] text-[34px] leading-none md:text-[40px] ${n ? 'right-[8%] rotate-[10deg]' : 'left-[8%] -rotate-[10deg]'}`}>{e}</span>
                    ))}
                  </span>
                )}
              </span>
              <span className="px-2 py-2.5">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <ProductTabs initial={items} />

      <section className="card p-5">
        <h2 className="mb-4 flex items-center gap-2.5 text-xl font-bold"><span className="h-5 w-1.5 rounded bg-gold" />আমাদের সেবা</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {serviceCards.map((sv) => (
            <div key={sv.title} className="group relative flex flex-col gap-1.5 overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-white via-ivory to-gold-chip p-5 shadow-card transition hover:-translate-y-1 hover:border-gold hover:shadow-gold">
              <span className="pointer-events-none absolute -bottom-4 -right-3 select-none text-[96px] leading-none opacity-[.08] transition group-hover:opacity-[.14]" aria-hidden="true">{sv.bg}</span>
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy text-2xl shadow-md" aria-hidden="true">{sv.icon}</span>
              <b className="mt-1 text-lg">{sv.title}</b>
              <p className="relative text-sm text-muted">{sv.text}</p>
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
      <ChatBubble />
    </div>
  );
}
