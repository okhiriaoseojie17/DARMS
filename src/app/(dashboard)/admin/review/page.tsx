import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ReviewQueue from './ReviewQueue';

export default async function AdminReviewPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    redirect('/sign-in?next=/admin/review');
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <ReviewQueue userId={userData.user.id} />
    </main>
  );
}
