import type { MetadataRoute } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://deshtori.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/account', '/cart', '/invoice', '/d/', '/pay/'] }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
