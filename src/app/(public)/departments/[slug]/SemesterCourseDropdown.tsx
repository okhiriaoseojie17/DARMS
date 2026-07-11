'use client';

import { useRouter } from 'next/navigation';

type Course = { id: string; code: string; title: string };

export function SemesterCourseDropdown({ label, courses }: { label: string; courses: Course[] }) {
  const router = useRouter();

  return (
    <div>
      <h3 className="font-display text-sm font-semibold text-paper-100">{label}</h3>
      <select
        defaultValue=""
        onChange={(e) => {
          if (e.target.value) router.push(`/courses/${e.target.value}`);
        }}
        className="mt-2 w-full rounded-sm border border-paper-200/20 bg-transparent px-4 py-3 text-sm text-paper-50"
      >
        <option value="" disabled className="text-ink-950">
          {courses.length === 0 ? 'No courses yet' : `Select a course (${courses.length})`}
        </option>
        {courses.map((c) => (
          <option key={c.id} value={c.id} className="text-ink-950">
            {c.code} — {c.title}
          </option>
        ))}
      </select>
    </div>
  );
}
