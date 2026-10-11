import type { Category } from './content';

/** Built-in categories, used until the admin saves its own list. `query` is what gets searched on Taobao. */
/** `more`: two extra emoji drawn around the main icon when the category has no photo. */
export const DEFAULT_CATEGORIES: (Category & { icon: string; more?: string })[] = [
  { name: 'জুতা', query: 'Shoes', icon: '👟', more: '👠🥾' },
  { name: 'ব্যাগ', query: 'Bags', icon: '👜', more: '🎒👛' },
  { name: 'জুয়েলারি', query: 'Jewelry', icon: '💍', more: '📿💎' },
  { name: 'বিউটি', query: 'Beauty', icon: '💄', more: '💅🧴' },
  { name: 'ছেলেদের পোশাক', query: 'Men Clothing', icon: '👔', more: '👖🧥' },
  { name: 'মেয়েদের পোশাক', query: 'Women Clothing', icon: '👗', more: '👚👠' },
  { name: 'শিশু', query: 'Baby Items', icon: '🧸', more: '🍼👶' },
  { name: 'ফোন এক্সেসরিজ', query: 'Phone Accessories', icon: '📱', more: '🔌🎧' },
  { name: 'ইলেকট্রনিক্স', query: 'Electronics', icon: '🎧', more: '💻🔋' },
  { name: 'ঘর ও রান্নাঘর', query: 'Home & Kitchen', icon: '🍳', more: '🍽️🫖' },
  { name: 'ঘড়ি', query: 'Watches', icon: '⌚', more: '⏱️⌚' },
  { name: 'খেলাধুলা', query: 'Sports', icon: '⚽', more: '🏀🏸' },
  { name: 'পোষা প্রাণীর পণ্য', query: 'Pet Products', icon: '🐾', more: '🐶🐱' },
];

/** Admin list if saved, else defaults. Admin items without an icon get one from the matching default. */
export function withCategoryDefaults(saved: Category[] | null | undefined): (Category & { icon?: string; more?: string })[] {
  if (!saved?.length) return DEFAULT_CATEGORIES;
  return saved.map((c) => {
    const d = DEFAULT_CATEGORIES.find((x) => x.query === c.query || x.name === c.name);
    return { ...c, icon: (c as { icon?: string }).icon ?? d?.icon ?? '🛍', more: d?.more };
  });
}

/** URL word for a category: "Home & Kitchen" → "home-kitchen". Bangla-only names keep their letters. */
export const categorySlug = (c: Category) =>
  (c.query || c.name || '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

/** Clean, indexable page for a category, e.g. /category/shoes */
export const categoryPath = (c: Category) => `/category/${encodeURIComponent(categorySlug(c))}`;
export const categoryHref = categoryPath;
