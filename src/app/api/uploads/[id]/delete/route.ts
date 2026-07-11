import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/uploads/[id]/delete
// Soft-delete only — sets status='deleted' + deleted_at, the same lifecycle
// the architecture doc defines (any status -> deleted starts the retention
// countdown). The file's bytes are NOT removed here; the existing
// retention-purge cron physically removes them after the retention window,
// same as a rejected upload. Because "uploads_public_read_approved" only
// ever returns status='approved' rows, a deleted upload disappears from the
// public course page immediately — no caching-related follow-up needed on
// the read side for this specific case.
//
// RLS's "uploads_reviewer_update_scoped" policy (migration 0010) already
// covers this: it grants update access to anyone holding approve_uploads,
// reject_uploads, OR delete_uploads within the matching course/department/
// level scope. If the signed-in user doesn't hold delete_uploads there,
// this update is silently rejected by RLS and we return a 403.
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const { data: upload, error: fetchError } = await supabase
    .from('uploads')
    .select('id, uploader_id, generated_filename, course_id, status')
    .eq('id', params.id)
    .single();

  if (fetchError || !upload) {
    return NextResponse.json({ error: 'Upload not found or not visible to you' }, { status: 404 });
  }

  if (upload.status === 'deleted') {
    return NextResponse.json({ error: 'Already deleted' }, { status: 400 });
  }

  const { error } = await supabase
    .from('uploads')
    .update({
      status: 'deleted',
      deleted_at: new Date().toISOString(),
      reviewed_by: userData.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: 'Not authorized to delete this upload' }, { status: 403 });
  }

  await supabase.from('notifications').insert({
    profile_id: upload.uploader_id,
    type: 'upload_deleted',
    payload: {
      uploadId: upload.id,
      filename: upload.generated_filename,
      courseId: upload.course_id,
    },
  });

  return NextResponse.json({ success: true });
}
