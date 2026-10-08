/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,

  // Self-contained server build for the Docker image (Coolify).
  output: 'standalone',

  images: {
    remotePatterns: [
      // Vercel Blob (optional Writerfy image storage)
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
  },

  async redirects() {
    return [
      // Removed user-account pages — Famies has no public accounts.
      { source: '/dashboard/:path*', destination: '/admin', permanent: false },
      { source: '/settings', destination: '/admin', permanent: false },
      { source: '/register', destination: '/', permanent: true },
      { source: '/blog', destination: '/inspiration', permanent: true },
    ];
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
      {
        source: '/admin/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;
