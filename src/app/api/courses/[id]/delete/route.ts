import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/courses/[id]/delete
// "Delete" here means the same non-destructive transition uploads already
// use: the course's status flips to 'archived', which RLS's
// "courses_public_read_approved" (status='approved' only) already excludes
// from every public read — the department listing and the course's own
// detail page both disappear immediately, with nothing physically removed.
// There's no separate 'deleted' course_status value (adding one means an
// ALTER TYPE migration); reusing 'archived' avoids that and matches the
// architecture doc's existing archived <-> approved lifecycle, which is
// already reversible by a direct status update if a course is archived by
// mistake.
//
// This update is subject to RLS's "courses_reviewer_update_scoped" policy
// (migration 0023) — only manage_courses holders in the matching
// department scope can perform it.
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const { data: course, error: fetchError } = await supabase
    .from('courses')
    .select('id, code, title, status')
    .eq('id', params.id)
    .single();

  if (fetchError || !course) {
    return NextResponse.json({ error: 'Course not found or not visible to you' }, { status: 404 });
  }

  if (course.status === 'archived') {
    return NextResponse.json({ error: 'Already deleted' }, { status: 400 });
  }

  const { error } = await supabase
    .from('courses')
    .update({ status: 'archived' })
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: 'Not authorized to delete this course' }, { status: 403 });
  }

  return NextResponse.json({ success: true });
}
