'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { displaySemester } from '@/lib/semester';

type ApprovedCourse = {
  id: string;
  code: string;
  title: string;
  semester: string;
  department_id: string;
  level_id: string;
  departments: { name: string } | null;
  levels: { name: string } | null;
};

export default function ManageCourses({ userId }: { userId: string }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [courses, setCourses] = useState<ApprovedCourse[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadCourses() {
    const { data: perms } = await supabase
      .from('permission_assignments')
      .select('revoked_at, permissions(key)')
      .eq('profile_id', userId);

    const detectedAccess = (perms ?? []).some((row: any) => {
      const permsForRow = Array.isArray(row.permissions) ? row.permissions : [row.permissions];
      return row.revoked_at === null && permsForRow.some((p: any) => p?.key === 'manage_courses');
    });
    setHasAccess(detectedAccess);

    if (!detectedAccess) {
      setLoading(false);
      return;
    }

    // Live, approved courses only — the same set visible to the public,
    // which is what this tab exists to let an admin clean up.
    const { data: approved } = await supabase
      .from('courses')
      .select('*, departments(name), levels(name)')
      .eq('status', 'approved')
      .order('code');

    setCourses((approved as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleDelete(id: string, label: string) {
    if (
      !window.confirm(
        `Delete "${label}" permanently? This also permanently deletes every file uploaded to it from Supabase Storage — there's no undo.`
      )
    ) {
      return;
    }
    setBusyId(id);
    setMessage(null);
    const res = await fetch(`/api/courses/${id}/delete`, { method: 'POST' });
    const data = await res.json();
    setBusyId(null);

    if (res.status === 207) {
      setMessage(data.warning ?? 'Removed from the site, but storage cleanup failed — check Supabase.');
      setCourses((prev) => prev.filter((c) => c.id !== id));
      return;
    }
    if (!res.ok) {
      setMessage(data.error ?? 'Delete failed.');
      return;
    }
    setCourses((prev) => prev.filter((c) => c.id !== id));
  }

  if (loading) {
    return <p className="text-sm text-ink-700">Loading…</p>;
  }

  if (!hasAccess) {
    return (
      <div className="text-center text-ink-950">
        <h1 className="mt-6 font-display text-2xl font-semibold">No course-management access</h1>
        <p className="mt-2 text-sm text-ink-700">
          You don't currently hold course-management permissions for any department.
          If you should, ask a department administrator to grant it.
        </p>
      </div>
    );
  }

  return (
    <div className="text-ink-950">
      <p className="text-sm text-ink-700">
        Live, approved courses within your scope — {courses.length} total.
        Deleting one hides it from the site immediately; nothing about the
        course or its uploads is physically removed.
      </p>

      {message && <p className="mt-4 text-sm text-red-600">{message}</p>}

      {courses.length === 0 && (
        <p className="mt-10 text-ink-700/60">No approved courses in your scope.</p>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {courses.map((course) => (
          <div key={course.id} className="rounded-sm border border-ink-700/15 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-ink-700">
                  {course.departments?.name} · {course.levels?.name} · {displaySemester(course.semester)} Semester
                </p>
                <p className="mt-1 font-display text-lg">
                  {course.code} — {course.title}
                </p>
              </div>
              <button
                onClick={() => handleDelete(course.id, `${course.code} — ${course.title}`)}
                disabled={busyId === course.id}
                className="shrink-0 rounded-sm border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
              >
                {busyId === course.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
