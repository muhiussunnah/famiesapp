import BlogPageClient from './BlogPageClient';
import { getLivePosts } from '@/lib/blog';
import { BLOG_PATH } from '@/lib/site';

export const metadata = {
  title: 'Inspiration – tips, guider & familjeidéer',
  description:
    'Riktiga tips från riktiga familjer: utflykter, aktiviteter, mat, lek och familjeliv. Plocka upp något nytt att göra med barnen.',
  alternates: { canonical: BLOG_PATH },
  openGraph: {
    title: 'Inspiration – tips, guider & familjeidéer · Famies',
    description: 'Riktiga tips från riktiga familjer: utflykter, aktiviteter, mat, lek och familjeliv.',
    url: BLOG_PATH,
    type: 'website',
  },
};

export default async function InspirationPage({ searchParams }) {
  const [articles, params] = await Promise.all([getLivePosts(), searchParams]);
  const category = typeof params?.category === 'string' ? params.category : undefined;

  return <BlogPageClient articles={articles} initialCategory={category} />;
}
