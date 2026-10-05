import type { Metadata } from 'next';
import Link from 'next/link';
import { getContent, type Post } from '@/lib/content';

export const metadata: Metadata = { title: 'ব্লগ — DeshTori', description: 'চীন থেকে পণ্য আমদানি, অর্ডার ও শিপিং নিয়ে গাইড।' };

export default async function Blog() {
  const posts = ((await getContent<Post[]>('blog')) ?? []).filter((p) => p.slug && p.title);
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-3 py-5 md:px-6">
      <h1 className="text-2xl font-bold">ব্লগ</h1>
      {!posts.length && <p className="card p-8 text-center text-muted">শিগগিরই লেখা আসছে।</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => (
          <Link key={p.slug} href={`/blog/${p.slug}`} className="card overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.image && <img src={p.image} alt="" className="aspect-video w-full object-cover" loading="lazy" />}
            <div className="p-4"><p className="text-xs text-muted">{p.date}</p><h2 className="text-lg font-bold">{p.title}</h2><p className="line-clamp-3 text-sm text-muted">{p.excerpt}</p></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
