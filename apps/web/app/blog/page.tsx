import type { Metadata } from 'next';
import Link from 'next/link';
import { categoriesOf, getPosts, readMinutes, SITE_URL } from '@/lib/blog';
import type { Post } from '@/lib/content';

type Props = { searchParams: { category?: string } };

const DESC = 'চীন থেকে পণ্য আমদানি, কীভাবে খরচ বাঁচাবেন, আসল ও বিশ্বস্ত মূল সাপ্লায়ার চেনা এবং পণ্যের মান যাচাই নিয়ে বাংলায় গাইড।';

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const cat = searchParams.category?.trim();
  const title = cat ? `${cat} — ব্লগ | DeshTori` : 'ব্লগ — চীন থেকে পণ্য আমদানি ও শিপিং গাইড | DeshTori';
  const url = cat ? `${SITE_URL}/blog?category=${encodeURIComponent(cat)}` : `${SITE_URL}/blog`;
  return { title, description: DESC, alternates: { canonical: url }, openGraph: { title, description: DESC, url, type: 'website', siteName: 'DeshTori', locale: 'bn_BD' } };
}

const bnDate = (s?: string) => (s && !Number.isNaN(Date.parse(s)) ? new Date(s).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' }) : s ?? '');

/** Icons for the blog categories; unknown ones get a book. */
const CAT_ICON: Record<string, string> = { 'চীন থেকে পণ্য আমদানি': '🚢', 'শিপিং গাইড': '✈️', '1688/Taobao গাইড': '🛒', 'ব্যবসার টিপস': '💡' };
const icon = (c: string) => CAT_ICON[c] ?? '📘';

function Cover({ p, big }: { p: Post; big?: boolean }) {
  return p.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.image} alt={p.title ?? ''} className="aspect-video w-full object-cover transition duration-300 group-hover:scale-[1.03]" loading={big ? 'eager' : 'lazy'} />
  ) : (
    <div className="flex aspect-video w-full items-end bg-gradient-to-br from-[#1A3C8A] to-[#0A1F52] p-4" aria-hidden="true">
      <span className="line-clamp-2 text-lg font-bold text-white">{p.title}</span>
    </div>
  );
}

function Meta({ p }: { p: Post }) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
      {p.category && <span className="chip bg-gold-chip text-gold-ink">{p.category}</span>}
      <time dateTime={p.date}>{bnDate(p.date)}</time>
      <span>· {readMinutes(p.body).toLocaleString('bn-BD')} মিনিটে পড়ুন</span>
    </p>
  );
}

export default async function Blog({ searchParams }: Props) {
  const all = await getPosts();
  const cats = categoriesOf(all);
  const active = searchParams.category?.trim() || '';
  const posts = active ? all.filter((p) => p.category === active) : all;
  const [first, ...rest] = posts;
  const count = (c: string) => all.filter((p) => p.category === c).length;
  const item = (href: string, label: string, ico: string, n: number, on: boolean) => (
    <li key={href}>
      <Link href={href} aria-current={on ? 'page' : undefined} className={`group flex items-center gap-3 px-4 py-2.5 text-[15px] font-medium transition hover:bg-gold-chip hover:pl-5 active:bg-gold/30 ${on ? 'bg-gold-chip font-bold text-navy' : ''}`}>
        <span className="w-6 text-center text-lg" aria-hidden="true">{ico}</span>
        <span className="flex-1">{label}</span>
        <span className="rounded-full bg-ivory px-2 text-xs text-muted">{n.toLocaleString('bn-BD')}</span>
      </Link>
    </li>
  );

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-5 px-3 py-5 md:px-6">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1A3C8A] to-[#0A1F52] p-6 text-white shadow-card md:p-10">
        <span className="pointer-events-none absolute -right-6 -top-6 select-none text-[160px] leading-none opacity-10" aria-hidden="true">📚</span>
        <span className="chip w-fit bg-white/10 text-gold-light">DeshTori ব্লগ</span>
        <h1 className="mt-3 text-3xl font-bold md:text-4xl">{active ? active : 'চীন থেকে আমদানির বাংলা গাইড'}</h1>
        <p className="mt-2 max-w-2xl text-[#DCE4F4] md:text-lg">{DESC}</p>
      </header>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:w-64 lg:flex-none">
          {!!cats.length && (
            <>
              <nav aria-label="ব্লগ ক্যাটাগরি" className="card hidden flex-col overflow-hidden lg:flex">
                <div className="flex items-center gap-2 bg-navy px-4 py-3 font-bold text-white"><span className="text-gold" aria-hidden="true">▦</span>ব্লগ ক্যাটাগরি</div>
                <ul className="flex flex-col py-1">
                  {item('/blog', 'সব লেখা', '📚', all.length, !active)}
                  {cats.map((c) => item(`/blog?category=${encodeURIComponent(c)}`, c, icon(c), count(c), active === c))}
                </ul>
              </nav>
              <nav aria-label="ব্লগ ক্যাটাগরি" className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 lg:hidden">
                <Link href="/blog" aria-current={!active ? 'page' : undefined} className={`chip min-h-[38px] flex-none border transition active:scale-95 ${!active ? 'border-navy bg-navy text-white' : 'border-ivory-line bg-white hover:bg-gold-chip'}`}>📚 সব লেখা</Link>
                {cats.map((c) => (
                  <Link key={c} href={`/blog?category=${encodeURIComponent(c)}`} aria-current={active === c ? 'page' : undefined} className={`chip min-h-[38px] flex-none border transition active:scale-95 ${active === c ? 'border-navy bg-navy text-white' : 'border-ivory-line bg-white hover:bg-gold-chip'}`}>{icon(c)} {c}</Link>
                ))}
              </nav>
            </>
          )}
          <div className="card hidden flex-col gap-3 bg-gradient-to-br from-white via-ivory to-gold-chip p-5 lg:flex">
            <b className="text-lg">পণ্য খুঁজছেন?</b>
            <p className="text-sm text-muted">চাইনিজ পণ্য খুব সহজে ঘরে বসে এখনই কিনুন বাংলা টাকায়।</p>
            <Link href="/search?q=trending" className="btn-gold">পণ্য খুঁজুন</Link>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-4">
          {!posts.length && <p className="card p-8 text-center text-muted">{active ? 'এই ক্যাটাগরিতে এখনো লেখা নেই।' : 'শিগগিরই লেখা আসছে।'}</p>}
          {first && (
            <Link href={`/blog/${first.slug}`} className="card group grid overflow-hidden transition hover:-translate-y-0.5 hover:border-gold hover:shadow-gold md:grid-cols-2">
              <span className="block overflow-hidden"><Cover p={first} big /></span>
              <div className="flex flex-col justify-center gap-2 p-5 md:p-7">
                <Meta p={first} />
                <h2 className="text-xl font-bold leading-snug md:text-2xl">{first.title}</h2>
                <p className="line-clamp-3 text-muted">{first.excerpt}</p>
                <span className="mt-1 font-bold text-navy group-hover:underline">পুরোটা পড়ুন →</span>
              </div>
            </Link>
          )}
          {!!rest.length && (
            <div className="grid gap-4 sm:grid-cols-2">
              {rest.map((p) => (
                <Link key={p.slug} href={`/blog/${p.slug}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-gold hover:shadow-gold">
                  <span className="block overflow-hidden"><Cover p={p} /></span>
                  <div className="flex flex-1 flex-col gap-1.5 p-4">
                    <Meta p={p} />
                    <h2 className="text-lg font-bold leading-snug">{p.title}</h2>
                    <p className="line-clamp-3 text-sm text-muted">{p.excerpt}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
