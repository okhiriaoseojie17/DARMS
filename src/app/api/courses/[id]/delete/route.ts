import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/courses/[id]/delete
// Archives the course (RLS only ever returns status='approved' to public
// reads, so this hides it immediately) AND cascades to every upload still
// attached to it: each one gets its storage bytes removed immediately and
// its status flipped to 'deleted'. Without this cascade, deleting a course
// would silently leave all its files sitting in Storage forever, still
// counting against quota — which defeats the point of deleting it at all
// on a storage-limited free tier.
//
// This DOES require the acting user to also hold delete_uploads in a scope
// covering each of those uploads — as Super Administrator (null scope,
// every permission) that's always true, but a narrower-scoped Department
// Admin could hit a partial failure here if their delete_uploads grant
// doesn't cover every course/level combination the course's uploads span.
// Any such failures are reported back rather than silently swallowed.
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const { data: course, error: fetchError } = await supabase
    .from('courses')
    .select('id, code, title, status')
    .eq('id', params.id)
    .single();

  if (fetchError || !course) {
    return NextResponse.json({ error: 'Course not found or not visible to you' }, { status: 404 });
  }

  if (course.status === 'archived') {
    return NextResponse.json({ error: 'Already deleted' }, { status: 400 });
  }

  const { error } = await supabase
    .from('courses')
    .update({ status: 'archived' })
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: 'Not authorized to delete this course' }, { status: 403 });
  }

  // Cascade: clear storage + soft-delete every upload still attached to
  // this course, so nothing keeps consuming Storage quota once the course
  // itself is gone from the site.
  const { data: courseUploads } = await supabase
    .from('uploads')
    .select('id, storage_path, storage_bucket')
    .eq('course_id', params.id)
    .neq('status', 'deleted');

  const storageFailures: string[] = [];

  for (const upload of courseUploads ?? []) {
    if (upload.storage_path && upload.storage_bucket) {
      const { error: storageError } = await supabase.storage
        .from(upload.storage_bucket)
        .remove([upload.storage_path]);
      if (storageError) {
        storageFailures.push(upload.id);
      }
    }
  }

  if (courseUploads && courseUploads.length > 0) {
    const { error: uploadsUpdateError } = await supabase
      .from('uploads')
      .update({ status: 'deleted', deleted_at: new Date().toISOString() })
      .eq('course_id', params.id)
      .neq('status', 'deleted');

    if (uploadsUpdateError) {
      return NextResponse.json(
        {
          warning: `Course deleted, but its uploads couldn't all be marked deleted: ${uploadsUpdateError.message}`,
        },
        { status: 207 }
      );
    }
  }

  if (storageFailures.length > 0) {
    return NextResponse.json(
      {
        warning: `Course deleted, but ${storageFailures.length} file(s) couldn't be cleared from storage. You may need to remove them manually in the Supabase dashboard.`,
      },
      { status: 207 }
    );
  }

  return NextResponse.json({ success: true });
}
