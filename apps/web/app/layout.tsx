import type { CSSProperties } from 'react';
import { getAppearance } from '@/lib/appearance';
import type { Metadata } from 'next';
import { Noto_Sans_Bengali, Cinzel } from 'next/font/google';
import './globals.css';
import { TopBar } from '@/components/TopBar';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Chrome } from '@/components/Chrome';
import { API_URL } from '@/lib/api';
import type { PublicSettings } from '@/lib/types';
import { getContent, type Seo } from '@/lib/content';

const bangla = Noto_Sans_Bengali({ subsets: ['bengali', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-bn', display: 'swap' });
const cinzel = Cinzel({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-cinzel' });

const BASE: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  openGraph: { siteName: 'DeshTori', locale: 'bn_BD', type: 'website', images: ['/brand/logo-footer.png'] },
  title: 'DeshTori – চীনের বাজার থেকে আপনার দুয়ারে',
  description: '1688 ও Taobao-র পণ্য টাকায় লাইভ দামে অর্ডার করুন। Air ৭–১৫ দিন, Sea ৪৫–৬৫ দিনে বাংলাদেশে ডোর-টু-ডোর ডেলিভারি।',
  icons: { icon: '/brand/logo-header.png' },
};

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://deshtori.com';
/** Lets Google show the brand, logo and a site search box in results. */
const SITE_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE}/#org`,
      name: 'DeshTori',
      url: SITE,
      logo: `${SITE}/brand/logo-footer.png`,
      slogan: 'চীনের বাজার থেকে আপনার দুয়ারে।',
      telephone: '+8801938273878',
      email: 'info@deshtori.com',
      address: { '@type': 'PostalAddress', streetAddress: '219 West Monipur, Barek Mollar Mor, 60 Fit Road, Mirpur-2', addressLocality: 'Dhaka', postalCode: '1216', addressCountry: 'BD' },
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE}/#site`,
      url: SITE,
      name: 'DeshTori',
      inLanguage: 'bn-BD',
      publisher: { '@id': `${SITE}/#org` },
      potentialAction: { '@type': 'SearchAction', target: `${SITE}/search?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
    },
  ],
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
  const [settings, appearance] = await Promise.all([getSettings(), getAppearance()]);
  const colors = Object.fromEntries(Object.entries({ navy: appearance.primary, gold: appearance.accent, emerald: appearance.secondary, ivory: appearance.background }).map(([name, hex]) => [`--dt-${name}`, /^#[a-fA-F0-9]{6}$/.test(hex) ? `${parseInt(hex.slice(1, 3), 16)} ${parseInt(hex.slice(3, 5), 16)} ${parseInt(hex.slice(5, 7), 16)}` : undefined])) as CSSProperties;
  return (
    <html lang="bn" className={`${bangla.variable} ${cinzel.variable}`} suppressHydrationWarning style={colors}>
      <head>
        {/* apply saved theme before paint (no flash) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('dt-theme')||${JSON.stringify(appearance.defaultTheme).replace(/</g, '\\u003c')};var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}`,
          }}
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_LD) }} />
      </head>
      <body className="min-h-screen flex flex-col">
        <Chrome top={<TopBar notice={settings?.notice} />} header={<Header logo={appearance.headerLogo} showImageSearch={appearance.showImageSearch} showShipping={appearance.showShipping} />} footer={<Footer logo={appearance.footerLogo} />} showMobileNav={appearance.showMobileNav} showShipping={appearance.showShipping}>
          {children}
        </Chrome>
      </body>
    </html>
  );
}
