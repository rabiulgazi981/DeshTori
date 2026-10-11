import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SearchView } from '@/components/SearchView';
import { getContent, type Category } from '@/lib/content';
import { categoryPath, categorySlug, withCategoryDefaults } from '@/lib/categories';

type Props = { params: { slug: string }; searchParams: { page?: string; sort?: string } };

async function find(slug: string) {
  const want = decodeURIComponent(slug).toLowerCase();
  return withCategoryDefaults(await getContent<Category[]>('categories')).find((c) => categorySlug(c) === want);
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const c = await find(params.slug);
  if (!c) return {};
  const name = c.name || c.query || '';
  return {
    title: `${name} চীন থেকে কিনুন, বাংলা টাকায় দাম | DeshTori`,
    description: `চীনের কারখানা ও মূল সাপ্লায়ারের ${name} বাংলা টাকায় লাইভ দামে অর্ডার করুন। Air ৭–১৫ দিন, Sea ৪৫–৬৫ দিনে ঘরে ডেলিভারি।`,
    alternates: { canonical: categoryPath(c) },
    // sorted / later pages are the same listing; keep only the main page in Google
    robots: searchParams.sort || (searchParams.page && searchParams.page !== '1') ? { index: false, follow: true } : undefined,
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const c = await find(params.slug);
  if (!c) notFound();
  return <SearchView q={c.query || c.name || ''} page={searchParams.page} sort={searchParams.sort} base={categoryPath(c)} title={c.name} />;
}
