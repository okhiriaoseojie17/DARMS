import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function CourseDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  // RLS's "courses_public_read_approved" policy already ensures a signed-out
  // visitor can only ever get this row back if status = 'approved'.
  const { data: course } = await supabase
    .from('courses')
    .select('*, departments(name, code), levels(name)')
    .eq('id', params.id)
    .single();

  if (!course) notFound();

  // Same protection applies here via "uploads_public_read_approved" — a
  // pending/rejected upload simply never comes back for a signed-out visitor.
  const { data: uploads } = await supabase
    .from('uploads')
    .select('*')
    .eq('course_id', course.id)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  function resolveDownloadUrl(upload: any) {
    if (upload.file_type === 'link') return upload.external_url as string;
    if (!upload.storage_path) return null;
    return supabase.storage.from('uploads-approved').getPublicUrl(upload.storage_path).data.publicUrl;
  }

  return (
    <main className="min-h-screen bg-ink-950 px-6 py-16 text-paper-50">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/departments/${course.departments?.code?.toLowerCase()}`}
          className="text-sm text-paper-200/60 hover:text-amber-500"
        >
          &larr; {course.departments?.name}
        </Link>
        <p className="mt-4 font-mono text-xs text-amber-500">
          {course.code} · Level {course.levels?.name} · {course.semester} Semester
        </p>
        <h1 className="font-display text-3xl font-semibold">{course.title}</h1>

        <h2 className="mt-10 font-display text-lg font-semibold text-paper-100">Resources</h2>

        {(uploads ?? []).length === 0 && (
          <p className="mt-3 text-paper-200/60">
            No approved resources for this course yet — check back soon, or{' '}
            <Link href="/sign-in" className="underline hover:text-amber-500">
              sign in
            </Link>{' '}
            to contribute one.
          </p>
        )}

        <div className="mt-3 flex flex-col gap-3">
          {(uploads ?? []).map((upload) => {
            const url = resolveDownloadUrl(upload);
            return (
              <a
                key={upload.id}
                href={url ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-sm border border-paper-200/15 p-4 transition-colors hover:border-amber-500/60"
              >
                <div>
                  <p className="font-mono text-xs text-paper-200/50">
                    {upload.academic_year} · {upload.semester} Semester
                  </p>
                  <p className="mt-1 font-display text-base">{upload.generated_filename}</p>
                </div>
                <span className="text-xs uppercase tracking-wide text-amber-500">
                  {upload.file_type}
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </main>
  );
}
