/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@deshtori/shared'],
  async rewrites() {
    return process.env.INTERNAL_API_URL ? [{
      source: '/api/:path*',
      destination: `${process.env.INTERNAL_API_URL}/:path*`,
    }] : [];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.alicdn.com' },
      { protocol: 'https', hostname: '**.1688.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },
};
export default nextConfig;
