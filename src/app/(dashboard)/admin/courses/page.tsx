// app/admin/courses/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CourseRequestQueue from './CourseRequestQueue';

export default async function AdminCourseRequestsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    redirect('/sign-in?next=/admin/courses');
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <CourseRequestQueue userId={userData.user.id} />
    </main>
  );
}