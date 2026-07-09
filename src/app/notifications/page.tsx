import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import NotificationsList from './NotificationsList';

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    redirect('/sign-in?next=/notifications');
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-16">
      <NotificationsList userId={userData.user.id} />
    </main>
  );
}
