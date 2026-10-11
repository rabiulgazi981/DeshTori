import type { Metadata } from 'next';
import Link from 'next/link';
import { categoriesOf, getPosts, readMinutes, SITE_URL } from '@/lib/blog';

type Props = { searchParams: { category?: string } };

const DESC = 'চীন থেকে পণ্য আমদানি, কীভাবে খরচ বাঁচাবেন, আসল ও বিশ্বস্ত মূল সাপ্লায়ার চেনা এবং পণ্যের মান যাচাই নিয়ে বাংলায় গাইড।';

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const cat = searchParams.category?.trim();
  const title = cat ? `${cat} — ব্লগ | DeshTori` : 'ব্লগ — চীন থেকে পণ্য আমদানি ও শিপিং গাইড | DeshTori';
  const url = cat ? `${SITE_URL}/blog?category=${encodeURIComponent(cat)}` : `${SITE_URL}/blog`;
  return { title, description: DESC, alternates: { canonical: url }, openGraph: { title, description: DESC, url, type: 'website', siteName: 'DeshTori', locale: 'bn_BD' } };
}

const bnDate = (s?: string) => (s && !Number.isNaN(Date.parse(s)) ? new Date(s).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' }) : s ?? '');

export default async function Blog({ searchParams }: Props) {
  const all = await getPosts();
  const cats = categoriesOf(all);
  const active = searchParams.category?.trim() || '';
  const posts = active ? all.filter((p) => p.category === active) : all;
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-3 py-5 md:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold md:text-3xl">{active ? `ব্লগ: ${active}` : 'ব্লগ'}</h1>
        <p className="text-muted">{DESC}</p>
      </header>
      {!!cats.length && (
        <nav className="flex flex-wrap gap-2" aria-label="ব্লগ ক্যাটাগরি">
          <Link href="/blog" aria-current={!active ? 'page' : undefined} className={`chip min-h-[36px] border ${!active ? 'border-navy bg-navy text-white' : 'border-ivory-line bg-white'}`}>সব লেখা</Link>
          {cats.map((c) => (
            <Link key={c} href={`/blog?category=${encodeURIComponent(c)}`} aria-current={active === c ? 'page' : undefined} className={`chip min-h-[36px] border ${active === c ? 'border-navy bg-navy text-white' : 'border-ivory-line bg-white'}`}>{c}</Link>
          ))}
        </nav>
      )}
      {!posts.length && <p className="card p-8 text-center text-muted">{active ? 'এই ক্যাটাগরিতে এখনো লেখা নেই।' : 'শিগগিরই লেখা আসছে।'}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => (
          <Link key={p.slug} href={`/blog/${p.slug}`} className="card flex flex-col overflow-hidden transition hover:-translate-y-0.5">
            {p.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image} alt={p.title ?? ''} className="aspect-video w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex aspect-video w-full items-end bg-gradient-to-br from-[#1A3C8A] to-[#0A1F52] p-4" aria-hidden="true">
                <span className="line-clamp-2 text-lg font-bold text-white">{p.title}</span>
              </div>
            )}
            <div className="flex flex-1 flex-col gap-1.5 p-4">
              <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                {p.category && <span className="chip bg-gold-chip text-gold-ink">{p.category}</span>}
                <time dateTime={p.date}>{bnDate(p.date)}</time>
                <span>· {readMinutes(p.body).toLocaleString('bn-BD')} মিনিটে পড়ুন</span>
              </p>
              <h2 className="text-lg font-bold leading-snug">{p.title}</h2>
              <p className="line-clamp-3 text-sm text-muted">{p.excerpt}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
