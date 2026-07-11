import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { profileUpdateSchema } from '@/lib/validation/profile';

// PATCH /api/profile
// Lets a signed-in user update their own display name, department, and
// level after onboarding. Department/level are single-select — upsert the
// chosen value first (safe even if unchanged), then delete any other rows
// for that profile.
//
// IMPORTANT: a blocked-by-RLS delete does NOT raise a Postgres error — it
// just matches zero rows silently. Without checking for that, this route
// would report success even when migration 0021's self-delete policy
// hasn't been applied and the old department/level was never actually
// removed. To catch that, each cleanup delete uses .select() to see
// exactly what it removed, and compares that against what was there
// beforehand — if something should have been cleaned up and wasn't, that's
// reported back as a warning instead of a silent no-op.
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = profileUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { displayName, departmentId, levelId } = parsed.data;
  const profileId = userData.user.id;
  const warnings: string[] = [];

  if (displayName) {
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', profileId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (departmentId) {
    const { data: priorRows } = await supabase
      .from('profile_departments')
      .select('department_id')
      .eq('profile_id', profileId);

    const hadOtherDepartment = (priorRows ?? []).some((r) => r.department_id !== departmentId);

    const { error: upsertError } = await supabase
      .from('profile_departments')
      .upsert(
        { profile_id: profileId, department_id: departmentId },
        { onConflict: 'profile_id,department_id', ignoreDuplicates: true }
      );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    const { data: cleanedRows, error: cleanupError } = await supabase
      .from('profile_departments')
      .delete()
      .eq('profile_id', profileId)
      .neq('department_id', departmentId)
      .select();

    if (cleanupError) {
      return NextResponse.json({ error: cleanupError.message }, { status: 500 });
    }

    if (hadOtherDepartment && (cleanedRows ?? []).length === 0) {
      warnings.push(
        'Department saved, but your old department could not be removed — this usually means migration 0021_profile_edit_policies.sql has not been run yet.'
      );
    }
  }

  if (levelId) {
    const { data: priorRows } = await supabase
      .from('profile_levels')
      .select('level_id')
      .eq('profile_id', profileId);

    const hadOtherLevel = (priorRows ?? []).some((r) => r.level_id !== levelId);

    const { error: upsertError } = await supabase
      .from('profile_levels')
      .upsert(
        { profile_id: profileId, level_id: levelId },
        { onConflict: 'profile_id,level_id', ignoreDuplicates: true }
      );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    const { data: cleanedRows, error: cleanupError } = await supabase
      .from('profile_levels')
      .delete()
      .eq('profile_id', profileId)
      .neq('level_id', levelId)
      .select();

    if (cleanupError) {
      return NextResponse.json({ error: cleanupError.message }, { status: 500 });
    }

    if (hadOtherLevel && (cleanedRows ?? []).length === 0) {
      warnings.push(
        'Level saved, but your old level could not be removed — this usually means migration 0021_profile_edit_policies.sql has not been run yet.'
      );
    }
  }

  if (warnings.length > 0) {
    return NextResponse.json({ warning: warnings.join(' ') }, { status: 207 });
  }

  return NextResponse.json({ success: true });
}
