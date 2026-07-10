import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// This route now lives inside /admin/review as the "Course requests" tab.
// Kept as a redirect so any existing links or bookmarks to /admin/courses
// still land somewhere useful.
export default async function AdminCourseRequestsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    redirect('/sign-in?next=/admin/review%3Ftab=courses');
  }

  redirect('/admin/review?tab=courses');
}
