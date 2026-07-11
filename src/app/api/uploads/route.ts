import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createUploadSchema } from '@/lib/validation/upload';
import { generateFilename } from '@/lib/naming/generateFilename';
import { moveUploadToApprovedBucket } from '@/lib/uploads/moveToApprovedBucket';

// GET /api/uploads — lists the signed-in user's own uploads (any status).
export async function GET() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('uploads')
    .select('*')
    .eq('uploader_id', userData.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ uploads: data });
}

// POST /api/uploads — writes the metadata row for a resource.
// For file-backed uploads, the browser has ALREADY uploaded the bytes
// directly to the `uploads-pending` Supabase Storage bucket (enforced by
// storage RLS, not by this route) before calling this endpoint.
// For link-type uploads (e.g. a YouTube video link), only externalUrl is needed.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createUploadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;

  // `semester` is read off the course row, not the client — a course is
  // permanently tied to one semester at creation (a course code can't exist
  // in both Alpha and Omega), so asking the uploader again would just be a
  // second value that could disagree with the first.
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id, code, department_id, level_id, semester')
    .eq('id', input.courseId)
    .single();

  if (courseError || !course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 });
  }

  const generatedFilename = generateFilename({
    courseCode: course.code,
    resourceType: input.resourceType,
    label: input.label,
  });

  // `status` is deliberately omitted — the DB trigger (migration 0009)
  // decides pending vs. auto-approved based on the uploader's actual scoped
  // permissions, never on anything the client sends. `storage_bucket` starts
  // as 'uploads-pending' since that's genuinely where the browser just put
  // the file, regardless of what status the trigger assigns.
  //
  // `resource_type` IS persisted (migration 0022) — this is what the course
  // page groups by into Test 1 / Test 2 / Exam / Notes / Assignments /
  // Others folders.
  const { data, error } = await supabase
    .from('uploads')
    .insert({
      uploader_id: userData.user.id,
      course_id: course.id,
      department_id: course.department_id,
      level_id: course.level_id,
      semester: course.semester,
      academic_year: input.academicYear,
      file_type: input.fileType,
      resource_type: input.resourceType,
      display_label: input.label ?? generatedFilename,
      generated_filename: generatedFilename,
      storage_path: input.storagePath,
      storage_bucket: input.fileType === 'link' ? null : 'uploads-pending',
      file_size_bytes: input.fileSizeBytes,
      external_url: input.externalUrl,
      tags: input.tags ?? [],
      description: input.description,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If the trigger auto-approved this (Lecturer/Level Advisor with scoped
  // auto_approve rights), the file still physically sits in the pending
  // bucket — the trigger can't reach Storage, only this route can.
  if (data.status === 'approved') {
    await moveUploadToApprovedBucket(supabase, data);
  }

  return NextResponse.json({ upload: data }, { status: 201 });
}
