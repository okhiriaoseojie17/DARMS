import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import UploadOrRequest from './UploadOrRequest';

export default async function NewUploadPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    redirect('/sign-in?next=/uploads/new');
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-6 py-16">
      {/* useSearchParams (for the tab query param) requires a Suspense boundary */}
      <Suspense fallback={<p className="text-sm text-ink-700">Loading…</p>}>
        <UploadOrRequest />
      </Suspense>
    </main>
  );
}
