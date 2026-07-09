import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { onboardingSchema } from '@/lib/validation/onboarding';

// POST /api/profile/onboarding
// Runs once, right after first sign-in. Writes profile_departments,
// profile_levels, and (for lecturers) course_lecturers rows, then marks the
// profile as onboarded. All inserts go through the signed-in user's own
// session — RLS's "*_self_insert" policies (migration 0012) are what
// actually enforce that a user can only ever link records to themselves.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = onboardingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { profileType, departmentIds, levelIds, courseCodes } = parsed.data;
  const profileId = userData.user.id;

  const { error: deptError } = await supabase
    .from('profile_departments')
    .upsert(
      departmentIds.map((department_id) => ({ profile_id: profileId, department_id })),
      { onConflict: 'profile_id,department_id', ignoreDuplicates: true }
    );

  const { error: levelError } = await supabase
    .from('profile_levels')
    .upsert(
      levelIds.map((level_id) => ({ profile_id: profileId, level_id })),
      { onConflict: 'profile_id,level_id', ignoreDuplicates: true }
    );

  if (deptError || levelError) {
    return NextResponse.json(
      { error: (deptError ?? levelError)?.message },
      { status: 500 }
    );
  }

  const notFoundCourses: string[] = [];

  if (profileType === 'lecturer' && courseCodes && courseCodes.length > 0) {
    for (const code of courseCodes) {
      const { data: course } = await supabase
        .from('courses')
        .select('id')
        .ilike('code', code.trim())
        .maybeSingle();

      if (!course) {
        notFoundCourses.push(code.trim());
        continue;
      }

      await supabase
        .from('course_lecturers')
        .upsert(
          { course_id: course.id, profile_id: profileId, assigned_by: profileId },
          { onConflict: 'course_id,profile_id', ignoreDuplicates: true }
        );
    }
  }

  const { error: profileUpdateError } = await supabase
    .from('profiles')
    .update({ profile_type: profileType, onboarding_completed: true })
    .eq('id', profileId);

  if (profileUpdateError) {
    return NextResponse.json({ error: profileUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, notFoundCourses });
}
