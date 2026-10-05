import type { MetadataRoute } from 'next';
import { getContent, type Post } from '@/lib/content';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://deshtori.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixed = ['', '/ship', '/rates', '/quote', '/image-search', '/about', '/terms', '/privacy', '/refund-policy', '/blog'];
  const posts = ((await getContent<Post[]>('blog')) ?? []).filter((p) => p.slug);
  return [
    ...fixed.map((p) => ({ url: `${SITE}${p}`, changeFrequency: 'weekly' as const, priority: p ? 0.6 : 1 })),
    ...posts.map((p) => ({ url: `${SITE}/blog/${p.slug}`, lastModified: p.date ? new Date(p.date) : undefined, priority: 0.5 })),
  ];
}
