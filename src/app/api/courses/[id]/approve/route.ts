import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const { data: courseRequest, error: fetchError } = await supabase
    .from('course_creation_requests')
    .select('id, requested_by, department_id, level_id, code, title, semester, status')
    .eq('id', params.id)
    .single();

  if (fetchError || !courseRequest) {
    return NextResponse.json({ error: 'Request not found or not visible to you' }, { status: 404 });
  }

  if (courseRequest.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending requests can be approved' }, { status: 400 });
  }

  // Create the real course row first. This insert is itself subject to
  // "courses_reviewer_insert" (0019) — if the signed-in user doesn't hold
  // manage_courses in the right department scope, it's rejected here and we
  // never touch the request row at all.
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .insert({
      code: courseRequest.code,
      title: courseRequest.title,
      department_id: courseRequest.department_id,
      level_id: courseRequest.level_id,
      semester: courseRequest.semester,
      status: 'approved',
      created_by: userData.user.id,
    })
    .select()
    .single();

  if (courseError) {
    return NextResponse.json({ error: `Not authorized, or course creation failed: ${courseError.message}` }, { status: 403 });
  }

  const { error: updateError } = await supabase
    .from('course_creation_requests')
    .update({
      status: 'approved',
      reviewed_by: userData.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('status', 'pending');

  if (updateError) {
    return NextResponse.json({ error: 'Course created, but marking the request approved failed' }, { status: 500 });
  }

  await supabase.from('notifications').insert({
    profile_id: courseRequest.requested_by,
    type: 'course_approved',
    payload: {
      requestId: courseRequest.id,
      courseId: course.id,
      code: courseRequest.code,
      title: courseRequest.title,
    },
  });

  return NextResponse.json({ success: true, course });
}