import { redirect } from 'next/navigation';

/**
 * /admin/analytics → /admin. Analytics live on the Dashboard; this keeps
 * old bookmarks working instead of showing a 404.
 */
export default function AnalyticsRedirect() {
  redirect('/admin');
}
