import type { MetadataRoute } from 'next';
import { categoriesOf, getPosts, postUrl, SITE_URL } from '@/lib/blog';
import { blogCategoryPath } from '@/lib/blog';
import { categoryPath, withCategoryDefaults } from '@/lib/categories';
import { getContent, type Category } from '@/lib/content';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // only public pages: /ship and /quote need a login, so Google would just land on the login page
  const fixed = ['', '/rates', '/image-search', '/about', '/terms', '/privacy', '/refund-policy', '/blog'];
  const cats = withCategoryDefaults(await getContent<Category[]>('categories'));
  const posts = await getPosts();
  const date = (s?: string) => (s && !Number.isNaN(Date.parse(s)) ? new Date(s) : undefined);
  return [
    ...fixed.map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: 'weekly' as const, priority: p ? 0.6 : 1 })),
    ...cats.map((c) => ({ url: `${SITE_URL}${categoryPath(c)}`, changeFrequency: 'daily' as const, priority: 0.8 })),
    ...categoriesOf(posts).map((c) => ({ url: `${SITE_URL}${blogCategoryPath(c)}`, changeFrequency: 'weekly' as const, priority: 0.4 })),
    ...posts.map((p) => ({ url: postUrl(p), lastModified: date(p.date), changeFrequency: 'monthly' as const, priority: 0.7 })),
  ];
}
