import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const rejectSchema = z.object({ reason: z.string().min(3).max(500) });

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

  const { data: courseRequest, error: fetchError } = await supabase
    .from('course_creation_requests')
    .select('id, requested_by, code, title, status')
    .eq('id', params.id)
    .single();

  if (fetchError || !courseRequest) {
    return NextResponse.json({ error: 'Request not found or not visible to you' }, { status: 404 });
  }

  const { error } = await supabase
    .from('course_creation_requests')
    .update({
      status: 'rejected',
      decision_reason: parsed.data.reason,
      reviewed_by: userData.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .eq('status', 'pending');

  if (error) {
    return NextResponse.json({ error: 'Not authorized to reject this request' }, { status: 403 });
  }

  await supabase.from('notifications').insert({
    profile_id: courseRequest.requested_by,
    type: 'course_rejected',
    payload: {
      requestId: courseRequest.id,
      code: courseRequest.code,
      title: courseRequest.title,
      reason: parsed.data.reason,
    },
  });

  return NextResponse.json({ success: true });
}