import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const rejectSchema = z.object({ reason: z.string().min(3).max(500) });

// POST /api/uploads/[id]/reject
// No storage change here — a rejected file stays in the pending bucket
// until the retention-purge job removes it, giving the student a window to
// see why it was rejected before it disappears.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = rejectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: upload, error: fetchError } = await supabase
    .from('uploads')
    .select('id, uploader_id, generated_filename, course_id, status')
    .eq('id', params.id)
    .single();

  if (fetchError || !upload) {
    return NextResponse.json({ error: 'Upload not found or not visible to you' }, { status: 404 });
  }

  const { error } = await supabase
    .from('uploads')
    .update({
      status: 'rejected',
      rejection_reason: parsed.data.reason,
      reviewed_by: userData.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('status', 'pending');

  if (error) {
    return NextResponse.json({ error: 'Not authorized to reject this upload' }, { status: 403 });
  }

  await supabase.from('notifications').insert({
    profile_id: upload.uploader_id,
    type: 'upload_rejected',
    payload: {
      uploadId: upload.id,
      filename: upload.generated_filename,
      courseId: upload.course_id,
      reason: parsed.data.reason,
    },
  });

  return NextResponse.json({ success: true });
}
