import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Mirrors the RLS scope-matching logic purely so the UI can decide what to
 * show (e.g. hide the "Approve" button). This is NEVER the actual security
 * boundary — Postgres RLS (migration 0010) is. Even if this check is wrong or
 * bypassed, the database will still reject an unauthorized write.
 */
export async function hasPermission(
  supabase: SupabaseClient,
  params: {
    permissionKey: string;
    departmentId?: string;
    levelId?: string;
    courseId?: string;
  }
): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return false;

  const { data, error } = await supabase
    .from('permission_assignments')
    .select('id, permissions!inner(key), scope_department_id, scope_level_id, scope_course_id')
    .eq('profile_id', userData.user.id)
    .is('revoked_at', null)
    .eq('permissions.key', params.permissionKey);

  if (error || !data) return false;

  return data.some((row) => {
    const deptOk = !row.scope_department_id || row.scope_department_id === params.departmentId;
    const levelOk = !row.scope_level_id || row.scope_level_id === params.levelId;
    const courseOk = !row.scope_course_id || row.scope_course_id === params.courseId;
    return deptOk && levelOk && courseOk;
  });
}
