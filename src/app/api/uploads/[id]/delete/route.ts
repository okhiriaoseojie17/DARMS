import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/uploads/[id]/delete
// Deletion here does TWO things: (1) flips status to 'deleted' so the file
// disappears from every public read immediately (RLS only ever returns
// status='approved' rows), and (2) immediately removes the actual bytes
// from Supabase Storage. Unlike the architecture doc's original 90-day
// retention-window design, this project is on a storage-limited free tier,
// so a deleted file's bytes need to stop counting against quota right away
// rather than waiting for the retention-purge cron. That trades away the
// safety net of an undo window — once this runs, the file is gone for
// good, not just hidden.
//
// The status update is subject to RLS's "uploads_reviewer_update_scoped"
// policy (migration 0010) — only approve_uploads/reject_uploads/
// delete_uploads holders in the matching scope can do this at all.
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const { data: upload, error: fetchError } = await supabase
    .from('uploads')
    .select('id, uploader_id, generated_filename, course_id, status, storage_path, storage_bucket, file_type')
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

  // Site-visibility is already fixed by the status update above regardless
  // of what happens below — this part only affects Storage quota.
  if (upload.storage_path && upload.storage_bucket) {
    const { error: storageError } = await supabase.storage
      .from(upload.storage_bucket)
      .remove([upload.storage_path]);

    if (storageError) {
      return NextResponse.json(
        {
          warning: `Removed from the site, but couldn't clear the file from storage: ${storageError.message}. You may need to remove it manually in the Supabase dashboard.`,
        },
        { status: 207 }
      );
    }
  }

  return NextResponse.json({ success: true });
}
