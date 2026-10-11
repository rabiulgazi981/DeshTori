import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPost, getPosts, postUrl, readMinutes, SITE_URL } from '@/lib/blog';
import { PostBody } from '@/components/PostBody';

type Props = { params: { slug: string } };

const plain = (s = '') => s.replace(/\*\*/g, '').replace(/^#{2,3}\s+/gm, '').replace(/\s+/g, ' ').trim();
const describe = (p: { metaDescription?: string; excerpt?: string; body?: string }) => (p.metaDescription || p.excerpt || plain(p.body).slice(0, 160)).slice(0, 300);
const bnDate = (s?: string) => (s && !Number.isNaN(Date.parse(s)) ? new Date(s).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' }) : s ?? '');

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getPost(params.slug);
  if (!p) return { title: 'লেখা পাওয়া যায়নি — DeshTori', robots: { index: false } };
  const title = p.metaTitle || `${p.title} — DeshTori ব্লগ`;
  const description = describe(p);
  const url = postUrl(p);
  return {
    title,
    description,
    keywords: p.tags,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title,
      description,
      url,
      siteName: 'DeshTori',
      locale: 'bn_BD',
      publishedTime: p.date,
      section: p.category,
      tags: p.tags,
      images: p.image ? [{ url: p.image, alt: p.title }] : undefined,
    },
    twitter: { card: p.image ? 'summary_large_image' : 'summary', title, description, images: p.image ? [p.image] : undefined },
  };
}

export default async function PostPage({ params }: Props) {
  const p = await getPost(params.slug);
  if (!p) notFound();
  const related = (await getPosts()).filter((x) => x.slug !== p.slug && (!p.category || x.category === p.category)).slice(0, 3);
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: p.title,
      description: describe(p),
      image: p.image ? [p.image] : undefined,
      datePublished: p.date,
      dateModified: p.date,
      inLanguage: 'bn-BD',
      articleSection: p.category,
      keywords: p.tags?.join(', '),
      mainEntityOfPage: { '@type': 'WebPage', '@id': postUrl(p) },
      author: { '@type': 'Organization', name: 'DeshTori', url: SITE_URL },
      publisher: { '@type': 'Organization', name: 'DeshTori', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/brand/logo-header.png` } },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'হোম', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'ব্লগ', item: `${SITE_URL}/blog` },
        ...(p.category ? [{ '@type': 'ListItem', position: 3, name: p.category, item: `${SITE_URL}/blog?category=${encodeURIComponent(p.category)}` }] : []),
        { '@type': 'ListItem', position: p.category ? 4 : 3, name: p.title, item: postUrl(p) },
      ],
    },
  ];
  return (
    <div className="mx-auto flex max-w-[800px] flex-col gap-5 px-3 py-6 md:px-6">
      {/* JSON.stringify output with "<" escaped cannot break out of the script tag */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <nav aria-label="ব্রেডক্রাম্ব" className="flex flex-wrap gap-1 text-sm text-muted">
        <Link href="/" className="underline">হোম</Link> / <Link href="/blog" className="underline">ব্লগ</Link>
        {p.category && <> / <Link href={`/blog?category=${encodeURIComponent(p.category)}`} className="underline">{p.category}</Link></>}
      </nav>
      <article className="card overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.image && <img src={p.image} alt={p.title ?? ''} className="aspect-video w-full object-cover" />}
        <div className="p-5 md:p-8">
          <p className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            {p.category && <Link href={`/blog?category=${encodeURIComponent(p.category)}`} className="chip bg-gold-chip text-gold-ink">{p.category}</Link>}
            <time dateTime={p.date}>{bnDate(p.date)}</time>
            <span>· {readMinutes(p.body).toLocaleString('bn-BD')} মিনিটে পড়ুন</span>
          </p>
          <h1 className="mb-4 text-2xl font-bold leading-snug md:text-3xl">{p.title}</h1>
          {p.excerpt && <p className="mb-5 border-l-4 border-gold pl-3 text-lg text-muted">{p.excerpt}</p>}
          <PostBody body={p.body} />
          {!!p.tags?.length && (
            <ul className="mt-6 flex flex-wrap gap-2" aria-label="ট্যাগ">
              {p.tags.map((t) => <li key={t} className="chip bg-ivory-ph text-navy">#{t}</li>)}
            </ul>
          )}
        </div>
      </article>
      <aside className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <b className="text-lg">চীনের বাজার থেকে আপনার দুয়ারে।</b>
          <p className="text-sm text-muted">চাইনিজ পণ্য খুব সহজে ঘরে বসে এখনই কিনুন বাংলা টাকায়।</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/search?q=trending" className="btn-gold">পণ্য খুঁজুন</Link>
          <Link href="/rates" className="btn-outline">শিপিং রেট</Link>
        </div>
      </aside>
      {!!related.length && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold">আরও পড়ুন</h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {related.map((r) => (
              <li key={r.slug}>
                <Link href={`/blog/${r.slug}`} className="card block h-full p-4 hover:bg-ivory-soft">
                  <span className="text-xs text-muted">{r.category}</span>
                  <b className="mt-1 block leading-snug">{r.title}</b>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
