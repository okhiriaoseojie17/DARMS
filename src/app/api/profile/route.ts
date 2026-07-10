import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { profileUpdateSchema } from '@/lib/validation/profile';

// PATCH /api/profile
// Lets a signed-in user update their own display name, department, and
// level after onboarding. Department/level are single-select — a user has
// exactly one of each at a time, changeable. We upsert the chosen value
// FIRST (safe even if it's already their current selection — no conflict),
// then delete any other rows for that profile. This order means re-saving
// the same department/level never throws a duplicate-key error even if
// migration 0021's self-delete policy hasn't been applied yet; it just
// means old values won't get cleaned up until that migration is in place.
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
    const { error: upsertError } = await supabase
      .from('profile_departments')
      .upsert(
        { profile_id: profileId, department_id: departmentId },
        { onConflict: 'profile_id,department_id', ignoreDuplicates: true }
      );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    // Requires the self-delete policy from migration 0021. If that
    // migration hasn't run yet, this simply won't remove the old row(s) —
    // it won't error.
    const { error: cleanupError } = await supabase
      .from('profile_departments')
      .delete()
      .eq('profile_id', profileId)
      .neq('department_id', departmentId);

    if (cleanupError) {
      return NextResponse.json({ error: cleanupError.message }, { status: 500 });
    }
  }

  if (levelId) {
    const { error: upsertError } = await supabase
      .from('profile_levels')
      .upsert(
        { profile_id: profileId, level_id: levelId },
        { onConflict: 'profile_id,level_id', ignoreDuplicates: true }
      );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    const { error: cleanupError } = await supabase
      .from('profile_levels')
      .delete()
      .eq('profile_id', profileId)
      .neq('level_id', levelId);

    if (cleanupError) {
      return NextResponse.json({ error: cleanupError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
