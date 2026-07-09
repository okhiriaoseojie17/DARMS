import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { moveUploadToApprovedBucket } from '@/lib/uploads/moveToApprovedBucket';

// POST /api/uploads/[id]/approve
// The status update below is subject to RLS's "uploads_reviewer_update_scoped"
// policy (migration 0010) — if the signed-in user doesn't hold approve_uploads
// in the right department/level/course scope, that update is rejected and we
// never touch storage at all. Only once it succeeds do we move the file from
// the private pending bucket to the public approved bucket and notify the
// uploader — both are side effects of a change we've already verified was
// authorized, not separate authorization checks of their own.
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const { data: upload, error: fetchError } = await supabase
    .from('uploads')
    .select('id, storage_path, status, file_type, uploader_id, generated_filename, course_id')
    .eq('id', params.id)
    .single();

  if (fetchError || !upload) {
    return NextResponse.json({ error: 'Upload not found or not visible to you' }, { status: 404 });
  }

  if (upload.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending uploads can be approved' }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from('uploads')
    .update({ status: 'approved', reviewed_by: userData.user.id, reviewed_at: new Date().toISOString() })
    .eq('id', params.id);

  if (updateError) {
    return NextResponse.json({ error: 'Not authorized to approve this upload' }, { status: 403 });
  }

  const moveResult = await moveUploadToApprovedBucket(supabase, upload);

  await supabase.from('notifications').insert({
    profile_id: upload.uploader_id,
    type: 'upload_approved',
    payload: {
      uploadId: upload.id,
      filename: upload.generated_filename,
      courseId: upload.course_id,
    },
  });

  if (!moveResult.success) {
    return NextResponse.json(
      { warning: `Status updated, but the file move failed: ${moveResult.error}` },
      { status: 207 }
    );
  }

  return NextResponse.json({ success: true });
}
