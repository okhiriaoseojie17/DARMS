import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// This route now lives inside /uploads/new as the "Request a course" tab.
// Kept as a redirect (rather than deleted) so any existing links or
// bookmarks to /courses/new still land somewhere useful.
export default async function NewCourseRequestPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    redirect('/sign-in?next=/uploads/new%3Ftab=request');
  }

  redirect('/uploads/new?tab=request');
}
