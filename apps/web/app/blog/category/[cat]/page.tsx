import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Blog, { generateMetadata as blogMetadata } from '../../page';
import { blogCategorySlug, categoriesOf, getPosts } from '@/lib/blog';

type Props = { params: { cat: string } };

/** /blog/category/<slug> → the blog list filtered to that category. */
async function nameOf(slug: string) {
  const want = decodeURIComponent(slug).toLowerCase();
  return categoriesOf(await getPosts()).find((c) => blogCategorySlug(c) === want);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const name = await nameOf(params.cat);
  return name ? blogMetadata({ searchParams: { category: name } }) : {};
}

export default async function BlogCategory({ params }: Props) {
  const name = await nameOf(params.cat);
  if (!name) notFound();
  return <Blog searchParams={{ category: name }} />;
}
