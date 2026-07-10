import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { moveUploadToApprovedBucket } from '@/lib/uploads/moveToApprovedBucket';

// GET /api/admin/backfill-stuck-approvals
// One-time repair route: finds every upload marked approved in the DB whose
// file never actually made it to the uploads-approved bucket (an artifact
// of the earlier ON CONFLICT/RLS bug in moveToApprovedBucket) and re-runs
// the move for each. Safe to call more than once — already-fixed rows won't
// match the filter a second time. Gated behind manage_users so it can't be
// hit by just anyone who finds the URL; delete this route once you've
// confirmed everything is fixed, since it's not meant to be a permanent
// part of the app.
export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const { data: perms } = await supabase
    .from('permission_assignments')
    .select('revoked_at, permissions(key)')
    .eq('profile_id', userData.user.id);

  const isAdmin = (perms ?? []).some((row: any) => {
    const permsForRow = Array.isArray(row.permissions) ? row.permissions : [row.permissions];
    return row.revoked_at === null && permsForRow.some((p: any) => p?.key === 'manage_users');
  });

  if (!isAdmin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { data: stuck, error } = await supabase
    .from('uploads')
    .select('id, storage_path, file_type, generated_filename')
    .eq('status', 'approved')
    .eq('storage_bucket', 'uploads-pending');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!stuck || stuck.length === 0) {
    return NextResponse.json({ message: 'No stuck uploads found.', results: [] });
  }

  const results = [];
  for (const upload of stuck) {
    const result = await moveUploadToApprovedBucket(supabase, upload);
    results.push({
      id: upload.id,
      filename: upload.generated_filename,
      success: result.success,
      error: result.error ?? null,
    });
  }

  return NextResponse.json({ message: `Processed ${stuck.length} upload(s).`, results });
}
