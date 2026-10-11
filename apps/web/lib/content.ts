import { API_URL } from './api';

/** Server-side read of admin-editable site content (cached 60 s). */
export async function getContent<T>(key: string): Promise<T | null> {
  try {
    const r = await fetch(`${API_URL}/content/${key}`, { next: { revalidate: 60 } });
    if (!r.ok) return null;
    return ((await r.json()) as { value: T | null }).value;
  } catch {
    return null;
  }
}

export interface Video { title?: string; url?: string; thumb?: string }
export type BannerPlacement = 'hero' | 'wide';
/**
 * Home banner. `placement` 'hero' = slider inside the hero box behind the tagline;
 * 'wide' = full-width promo strip below the hero. Old items without placement are 'hero'.
 */
export interface Banner {
  image?: string;
  title?: string;
  subtitle?: string;
  link?: string;
  buttonText?: string;
  showButton?: boolean;
  placement?: BannerPlacement; // default 'hero'
  width?: 'full' | 'contained'; // default 'full'
  active?: boolean; // default true
  order?: number;
}
export interface Service { icon?: string; title?: string; text?: string }
export interface Category { name?: string; query?: string; image?: string; /** emoji or image URL, shown when there is no image */ icon?: string }
export interface Popup { on?: boolean; title?: string; text?: string; image?: string; link?: string; button?: string }
export interface Campaign { on?: boolean; title?: string; text?: string; couponCode?: string; endsAt?: string }
export interface Post {
  slug?: string;
  title?: string;
  date?: string; // YYYY-MM-DD
  image?: string; // cover
  excerpt?: string;
  /** plain text; lines starting with "## ", "### ", "- " or "1. " become headings/lists */
  body?: string;
  category?: string;
  tags?: string[];
  metaTitle?: string;
  metaDescription?: string;
  /** false = draft (hidden from the website). Missing = published. */
  published?: boolean;
}
export interface Pages { about?: string; terms?: string; privacy?: string; refund?: string; banned?: string }
export interface Seo { title?: string; description?: string; keywords?: string; ogImage?: string; googleVerify?: string; fbPixel?: string; gaId?: string }

/**
 * Active banners for one placement, in admin order, with defaults applied.
 * `bannersFor(await getContent<Banner[]>('banners'), 'hero')`
 */
export function bannersFor(list: Banner[] | null | undefined, placement: BannerPlacement): Banner[] {
  return (list ?? [])
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b && b.image && b.active !== false && (b.placement ?? 'hero') === placement)
    .sort((x, y) => (x.b.order ?? x.i) - (y.b.order ?? y.i) || x.i - y.i)
    .map(({ b }) => ({ ...b, placement: b.placement ?? 'hero', width: b.width ?? 'full', active: true, showButton: b.showButton ?? !!b.buttonText }));
}

/** YouTube id / Facebook video → embeddable URL + thumbnail. */
export function videoEmbed(url = ''): { embed: string; thumb: string | null } | null {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/);
  if (yt) return { embed: `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&rel=0`, thumb: `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg` };
  if (/facebook\.com|fb\.watch/.test(url)) return { embed: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&autoplay=1&show_text=false`, thumb: null };
  return null;
}
