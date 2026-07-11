import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { displaySemester } from '@/lib/semester';
import { SemesterCourseDropdown } from './SemesterCourseDropdown';

// Same reasoning as the course detail page: this list changes whenever an
// admin approves/deletes a course, so it shouldn't be served from a stale
// cache.
export const dynamic = 'force-dynamic';

export default async function DepartmentDetailPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient();

  const { data: department } = await supabase
    .from('departments')
    .select('*')
    .eq('code', params.slug.toUpperCase())
    .single();

  if (!department) notFound();

  const { data: deptLevels } = await supabase
    .from('department_levels')
    .select('levels(*)')
    .eq('department_id', department.id);

  const levels = (deptLevels ?? [])
    .map((row: any) => row.levels)
    .filter(Boolean)
    .sort((a: any, b: any) => a.sort_order - b.sort_order);

  // RLS's "courses_public_read_approved" policy means this only ever returns
  // approved courses to a signed-out visitor — no extra filtering needed here
  // for the public-safety side of things, only for grouping/display.
  const { data: courses } = await supabase
    .from('courses')
    .select('*')
    .eq('department_id', department.id)
    .order('code');

  return (
    <main className="min-h-screen bg-ink-950 px-6 py-16 text-paper-50">
      <div className="mx-auto max-w-4xl">
        <Link href="/departments" className="text-sm text-paper-200/60 hover:text-amber-500">
          &larr; All departments
        </Link>
        <p className="mt-4 font-mono text-xs text-amber-500">{department.code}</p>
        <h1 className="font-display text-3xl font-semibold">{department.name}</h1>

        {levels.length === 0 && (
          <p className="mt-8 text-paper-200/60">No levels configured for this department yet.</p>
        )}

        {levels.map((level: any) => {
          const levelCourses = (courses ?? []).filter((c) => c.level_id === level.id);
          // Alpha/Omega sections are hardcoded per level — they always
          // render, same as the Test 1/Test 2/Exam/etc. folders on a
          // course page, so the structure is visible even before any
          // courses exist for that level/semester.
          const alphaCourses = levelCourses.filter((c) => c.semester === 'First');
          const omegaCourses = levelCourses.filter((c) => c.semester === 'Second');

          return (
            <section key={level.id} className="mt-10">
              <h2 className="font-display text-xl font-semibold text-paper-100">
                Level {level.name}
              </h2>

              <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
                <SemesterCourseDropdown
                  label={`${displaySemester('First')} Semester`}
                  courses={alphaCourses}
                />
                <SemesterCourseDropdown
                  label={`${displaySemester('Second')} Semester`}
                  courses={omegaCourses}
                />
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
