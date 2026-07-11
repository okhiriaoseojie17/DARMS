import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { displaySemester } from '@/lib/semester';
import { CourseAITab } from './CourseAITab';

// Resource lists change often enough (new uploads, deletions) that caching
// isn't worth the staleness — without this, Next.js may serve a cached
// version of this page's data even after an upload is deleted or approved.
export const dynamic = 'force-dynamic';

// Fixed order, always rendered — a category with zero uploads still shows
// its own "Nothing here yet" section rather than disappearing, so the
// course's shape is visible even before it's been populated.
const CATEGORIES = [
  { key: 'test1', label: 'Test 1' },
  { key: 'test2', label: 'Test 2' },
  { key: 'exam', label: 'Exam' },
  { key: 'notes', label: 'Notes' },
  { key: 'assignment', label: 'Assignments' },
  { key: 'other', label: 'Others' },
] as const;

export default async function CourseDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();

  // Signed-in check happens here (server-side), not inside the AI tab
  // component — same pattern as the rest of the app: the server page decides
  // who's allowed, the client component just renders based on what it's given.
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id ?? null;

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

  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    uploads: (uploads ?? []).filter((u: any) => u.resource_type === cat.key),
  }));

  // What the AI tab needs to know: which categories actually have approved
  // material to generate from (no point letting someone pick "Exam" if there
  // are zero approved exams), and the note titles for the notes dropdown.
  const aiAvailability = {
    test1: grouped.find((g) => g.key === 'test1')!.uploads.length > 0,
    test2: grouped.find((g) => g.key === 'test2')!.uploads.length > 0,
    exam: grouped.find((g) => g.key === 'exam')!.uploads.length > 0,
    notes: (grouped.find((g) => g.key === 'notes')!.uploads as any[]).map((u) => ({
      id: u.id,
      label: u.display_label ?? u.generated_filename,
    })),
  };

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
          {course.code} · Level {course.levels?.name} · {displaySemester(course.semester)} Semester
        </p>
        <h1 className="font-display text-3xl font-semibold">{course.title}</h1>

        {(uploads ?? []).length === 0 && (
          <p className="mt-6 text-paper-200/60">
            No approved resources for this course yet — check back soon, or{' '}
            <Link href="/sign-in" className="underline hover:text-amber-500">
              sign in
            </Link>{' '}
            to contribute one.
          </p>
        )}

        <div className="mt-10 flex flex-col gap-10">
          {grouped.map((cat) => (
            <section key={cat.key}>
              <h2 className="font-display text-lg font-semibold text-paper-100">{cat.label}</h2>

              {cat.uploads.length === 0 ? (
                <p className="mt-3 text-sm text-paper-200/40">Nothing here yet.</p>
              ) : (
                <div className="mt-3 flex flex-col gap-3">
                  {cat.uploads.map((upload: any) => {
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
                            {upload.academic_year} · {displaySemester(upload.semester)} Semester
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
              )}
            </section>
          ))}

          <section>
            <h2 className="font-display text-lg font-semibold text-paper-100">AI Study Help</h2>
            <CourseAITab
              courseId={course.id}
              courseCode={course.code}
              isSignedIn={Boolean(userId)}
              availability={aiAvailability}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
