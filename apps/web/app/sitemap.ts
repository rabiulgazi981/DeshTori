import type { MetadataRoute } from 'next';
import { categoriesOf, getPosts, postUrl, SITE_URL } from '@/lib/blog';
import { DEFAULT_CATEGORIES } from '@/lib/categories';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixed = ['', '/ship', '/rates', '/quote', '/image-search', '/about', '/terms', '/privacy', '/refund-policy', '/blog'];
  const posts = await getPosts();
  const date = (s?: string) => (s && !Number.isNaN(Date.parse(s)) ? new Date(s) : undefined);
  return [
    ...fixed.map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: 'weekly' as const, priority: p ? 0.6 : 1 })),
    ...DEFAULT_CATEGORIES.map((c) => ({ url: `${SITE_URL}/search?q=${encodeURIComponent(c.query ?? c.name ?? '')}`, changeFrequency: 'daily' as const, priority: 0.8 })),
    ...categoriesOf(posts).map((c) => ({ url: `${SITE_URL}/blog?category=${encodeURIComponent(c)}`, changeFrequency: 'weekly' as const, priority: 0.4 })),
    ...posts.map((p) => ({ url: postUrl(p), lastModified: date(p.date), changeFrequency: 'monthly' as const, priority: 0.7 })),
  ];
}
