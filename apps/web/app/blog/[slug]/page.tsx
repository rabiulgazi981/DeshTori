import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getContent, type Post } from '@/lib/content';

const find = async (slug: string) => ((await getContent<Post[]>('blog')) ?? []).find((p) => p.slug === slug);

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await find(params.slug);
  return p ? { title: `${p.title} — DeshTori`, description: p.excerpt, openGraph: { images: p.image ? [p.image] : undefined } } : {};
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const p = await find(params.slug);
  if (!p) notFound();
  return (
    <div className="mx-auto max-w-[800px] px-3 py-6 md:px-6">
      <article className="card overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.image && <img src={p.image} alt="" className="aspect-video w-full object-cover" />}
        <div className="p-5 md:p-8">
          <p className="text-sm text-muted">{p.date}</p>
          <h1 className="mb-4 text-2xl font-bold md:text-3xl">{p.title}</h1>
          <div className="whitespace-pre-line leading-relaxed">{p.body}</div>
        </div>
      </article>
    </div>
  );
}
