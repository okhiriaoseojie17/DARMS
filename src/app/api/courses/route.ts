import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createCourseRequestSchema } from '@/lib/validation/course';

// GET /api/courses?department=&level=&q= — public, no auth required.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  let query = supabase.from('courses').select('*').eq('status', 'approved');

  const departmentId = searchParams.get('department');
  const levelId = searchParams.get('level');
  const q = searchParams.get('q');

  if (departmentId) query = query.eq('department_id', departmentId);
  if (levelId) query = query.eq('level_id', levelId);
  if (q) query = query.ilike('title', `%${q}%`);

  const { data, error } = await query.order('code');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ courses: data });
}

// POST /api/courses — creates a course_creation_request (pending review).
// Requires auth; RLS's insert policy on course_creation_requests enforces
// requested_by = auth.uid(), so we don't need to re-check that here.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createCourseRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('course_creation_requests')
    .insert({
      requested_by: userData.user.id,
      department_id: parsed.data.departmentId,
      level_id: parsed.data.levelId,
      code: parsed.data.code,
      title: parsed.data.title,
      semester: parsed.data.semester,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ request: data }, { status: 201 });
}
