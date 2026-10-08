import { redirect } from 'next/navigation';
import PostEditor from '@/components/admin/PostEditor';

export const metadata = { title: 'Edit page' };

/** /admin/pages/edit?id=12 */
export default async function EditPostPage({ searchParams }) {
  const { id } = await searchParams;
  const postId = String(Array.isArray(id) ? id[0] : id || '').trim();
  if (!/^\d+$/.test(postId)) redirect('/admin/pages');

  // key → a fresh editor (and fresh unsaved-changes baseline) per post.
  return <PostEditor key={postId} postId={postId} />;
}
