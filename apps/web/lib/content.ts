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
export interface Banner { image?: string; title?: string; link?: string }
export interface Service { icon?: string; title?: string; text?: string }
export interface Category { name?: string; query?: string; image?: string }
export interface Popup { on?: boolean; title?: string; text?: string; image?: string; link?: string; button?: string }
export interface Campaign { on?: boolean; title?: string; text?: string; couponCode?: string; endsAt?: string }
export interface Post { slug?: string; title?: string; date?: string; image?: string; excerpt?: string; body?: string }
export interface Pages { about?: string; terms?: string; privacy?: string; refund?: string; banned?: string }
export interface Seo { title?: string; description?: string; keywords?: string; ogImage?: string; googleVerify?: string; fbPixel?: string; gaId?: string }

/** YouTube id / Facebook video → embeddable URL + thumbnail. */
export function videoEmbed(url = ''): { embed: string; thumb: string | null } | null {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/);
  if (yt) return { embed: `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&rel=0`, thumb: `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg` };
  if (/facebook\.com|fb\.watch/.test(url)) return { embed: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&autoplay=1&show_text=false`, thumb: null };
  return null;
}
