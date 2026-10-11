import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { SearchView } from '@/components/SearchView';
import { categoryPath, DEFAULT_CATEGORIES } from '@/lib/categories';

type SP = { q?: string; page?: string; sort?: string };
const catFor = (q: string) => DEFAULT_CATEGORIES.find((c) => (c.query ?? '').toLowerCase() === q.toLowerCase());

export function generateMetadata({ searchParams }: { searchParams: SP }): Metadata {
  const q = (searchParams.q ?? '').trim();
  // free-text results are endless near-duplicates; let Google index the category pages instead
  return { title: q ? `“${q}” খুঁজুন | DeshTori` : 'পণ্য খুঁজুন | DeshTori', robots: { index: false, follow: true } };
}

export default function SearchPage({ searchParams }: { searchParams: SP }) {
  const q = (searchParams.q ?? '').trim();
  const cat = catFor(q);
  if (cat && !searchParams.sort && !searchParams.page) permanentRedirect(categoryPath(cat));
  return <SearchView q={q} page={searchParams.page} sort={searchParams.sort} />;
}
