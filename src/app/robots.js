import { absoluteUrl } from '@/lib/site';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/', '/login', '/auth/'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
