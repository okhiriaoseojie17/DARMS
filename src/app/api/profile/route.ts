import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { profileUpdateSchema } from '@/lib/validation/profile';

// PATCH /api/profile
// Lets a signed-in user update their own display name, department(s), and
// level(s) after onboarding. Department/level changes REPLACE the existing
// set rather than merge with it — since the UI shows these as multi-select
// toggles, "save" means "here is my full current selection," not "add
// these on top of what's there." All writes go through the user's own
// session; RLS's self_* policies (migrations 0012, 0021) are the actual
// enforcement, same as the onboarding route.
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

  const { displayName, departmentIds, levelIds } = parsed.data;
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

  // Note: delete-then-insert isn't atomic — a failure between the two
  // calls could leave a user with an empty selection. Fine at this scale;
  // worth wrapping in a Postgres function via rpc() if that ever bites.
  if (departmentIds) {
    const { error: deleteError } = await supabase
      .from('profile_departments')
      .delete()
      .eq('profile_id', profileId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    const { error: insertError } = await supabase
      .from('profile_departments')
      .insert(departmentIds.map((department_id) => ({ profile_id: profileId, department_id })));

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  if (levelIds) {
    const { error: deleteError } = await supabase
      .from('profile_levels')
      .delete()
      .eq('profile_id', profileId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    const { error: insertError } = await supabase
      .from('profile_levels')
      .insert(levelIds.map((level_id) => ({ profile_id: profileId, level_id })));

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
