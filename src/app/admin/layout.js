import { redirect } from 'next/navigation';
import { getAdminUser } from '@/lib/admin';
import AdminShell from './AdminShell';

export const metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

// Always check the session per request — never prerender an admin page.
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }) {
  const user = await getAdminUser();
  if (!user) redirect('/login?next=/admin');

  return <AdminShell userEmail={user.email ?? ''}>{children}</AdminShell>;
}
