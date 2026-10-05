import type { Metadata } from 'next';
import { Hind_Siliguri, Cinzel } from 'next/font/google';
import './globals.css';
import { TopBar } from '@/components/TopBar';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Chrome } from '@/components/Chrome';
import { API_URL } from '@/lib/api';
import type { PublicSettings } from '@/lib/types';
import { getContent, type Seo } from '@/lib/content';

const hind = Hind_Siliguri({ subsets: ['bengali', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-hind' });
const cinzel = Cinzel({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-cinzel' });

const BASE: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  openGraph: { siteName: 'DeshTori', locale: 'bn_BD', type: 'website', images: ['/brand/logo-footer.png'] },
  title: 'DeshTori – চীনের বাজার থেকে আপনার দুয়ারে',
  description: '1688 ও Taobao-র পণ্য টাকায় লাইভ দামে অর্ডার করুন। Air ৭–১৫ দিন, Sea ৪৫–৬৫ দিনে বাংলাদেশে ডোর-টু-ডোর ডেলিভারি।',
  icons: { icon: '/brand/logo-header.png' },
};

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getContent<Seo>('seo');
  if (!seo) return BASE;
  return {
    ...BASE,
    title: seo.title || BASE.title,
    description: seo.description || BASE.description,
    keywords: seo.keywords?.split(',').map((k) => k.trim()).filter(Boolean),
    openGraph: { ...BASE.openGraph, images: seo.ogImage ? [seo.ogImage] : BASE.openGraph?.images },
    verification: seo.googleVerify ? { google: seo.googleVerify } : undefined,
  };
}

async function getSettings(): Promise<PublicSettings | null> {
  try {
    const r = await fetch(`${API_URL}/settings/public`, { next: { revalidate: 60 } });
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <html lang="bn" className={`${hind.variable} ${cinzel.variable}`} suppressHydrationWarning>
      <head>
        {/* apply saved theme before paint (no flash) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('dt-theme')||'light';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <Chrome top={<TopBar notice={settings?.notice} />} header={<Header />} footer={<Footer />}>
          {children}
        </Chrome>
      </body>
    </html>
  );
}
