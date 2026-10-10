import type { Category } from './content';

/** Built-in categories, used until the admin saves its own list. `query` is what gets searched on Taobao. */
export const DEFAULT_CATEGORIES: (Category & { icon: string })[] = [
  { name: 'জুতা', query: 'Shoes', icon: '👟' },
  { name: 'ব্যাগ', query: 'Bags', icon: '👜' },
  { name: 'জুয়েলারি', query: 'Jewelry', icon: '💍' },
  { name: 'বিউটি', query: 'Beauty', icon: '💄' },
  { name: 'ছেলেদের পোশাক', query: 'Men Clothing', icon: '👔' },
  { name: 'মেয়েদের পোশাক', query: 'Women Clothing', icon: '👗' },
  { name: 'শিশু', query: 'Baby Items', icon: '🧸' },
  { name: 'ফোন এক্সেসরিজ', query: 'Phone Accessories', icon: '📱' },
  { name: 'ইলেকট্রনিক্স', query: 'Electronics', icon: '🎧' },
  { name: 'ঘর ও রান্নাঘর', query: 'Home & Kitchen', icon: '🍳' },
  { name: 'ঘড়ি', query: 'Watches', icon: '⌚' },
  { name: 'খেলাধুলা', query: 'Sports', icon: '⚽' },
  { name: 'পোষা প্রাণীর পণ্য', query: 'Pet Products', icon: '🐾' },
];

/** Admin list if saved, else defaults. Admin items without an icon get one from the matching default. */
export function withCategoryDefaults(saved: Category[] | null | undefined): (Category & { icon?: string })[] {
  if (!saved?.length) return DEFAULT_CATEGORIES;
  return saved.map((c) => ({ ...c, icon: (c as { icon?: string }).icon ?? DEFAULT_CATEGORIES.find((d) => d.query === c.query || d.name === c.name)?.icon ?? '🛍' }));
}

export const categoryHref = (c: Category) => `/search?q=${encodeURIComponent(c.query || c.name || '')}`;
