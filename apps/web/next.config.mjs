/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@deshtori/shared'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.alicdn.com' },
      { protocol: 'https', hostname: '**.1688.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },
};
export default nextConfig;
