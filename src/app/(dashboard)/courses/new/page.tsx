import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CourseRequestForm from './CourseRequestForm';

export default async function NewCourseRequestPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    redirect('/sign-in?next=/courses/new');
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-6 py-16">
      {/* useSearchParams (for returnTo) requires a Suspense boundary */}
      <Suspense fallback={<p className="text-sm text-ink-700">Loading…</p>}>
        <CourseRequestForm />
      </Suspense>
    </main>
  );
}
