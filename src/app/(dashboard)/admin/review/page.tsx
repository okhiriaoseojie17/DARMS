import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminReviewTabs from './AdminReviewTabs';

export default async function AdminReviewPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    redirect('/sign-in?next=/admin/review');
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      {/* useSearchParams (for the tab query param) requires a Suspense boundary */}
      <Suspense fallback={<p className="text-sm text-ink-700">Loading…</p>}>
        <AdminReviewTabs userId={userData.user.id} />
      </Suspense>
    </main>
  );
}
