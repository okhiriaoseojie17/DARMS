'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Department = { id: string; name: string; code: string };
type Level = { id: string; name: string };

export default function ProfileForm({
  userId,
  initialDisplayName,
  email,
}: {
  userId: string;
  initialDisplayName: string;
  email: string;
}) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function init() {
      const [{ data: deptData }, { data: levelData }, { data: myDepts }, { data: myLevels }] =
        await Promise.all([
          supabase.from('departments').select('*').order('name'),
          supabase.from('levels').select('*').order('sort_order'),
          supabase.from('profile_departments').select('department_id').eq('profile_id', userId),
          supabase.from('profile_levels').select('level_id').eq('profile_id', userId),
        ]);

      setDepartments(deptData ?? []);
      setLevels(levelData ?? []);
      // If old data has more than one row (from before this was single-select),
      // just take the first — saving will clean the rest up.
      setSelectedDepartment(myDepts?.[0]?.department_id ?? null);
      setSelectedLevel(myLevels?.[0]?.level_id ?? null);
      setLoading(false);
    }
    init();
  }, [supabase, userId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSuccess(false);
    setSubmitting(true);

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName,
        departmentId: selectedDepartment,
        levelId: selectedLevel,
      }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (res.status === 207) {
      setMessage(data.warning ?? "Saved, but something didn't fully apply — check Supabase.");
      return;
    }

    if (!res.ok) {
      setMessage(typeof data.error === 'string' ? data.error : 'Something went wrong — check your selections.');
      return;
    }

    setSuccess(true);
  }

  if (loading) {
    return <p className="text-sm text-ink-700/60">Loading…</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 text-ink-950">
      <div>
        <label className="font-display text-base font-semibold">Name</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="mt-2 w-full rounded-sm border border-ink-700/20 px-4 py-3 text-sm"
        />
      </div>

      <div>
        <label className="font-display text-base font-semibold">Email</label>
        <input
          type="text"
          value={email}
          disabled
          className="mt-2 w-full rounded-sm border border-ink-700/10 bg-ink-700/5 px-4 py-3 text-sm text-ink-700/60"
        />
        <p className="mt-1 text-xs text-ink-700/60">Email can&apos;t be changed here.</p>
      </div>

      <fieldset>
        <legend className="font-display text-base font-semibold">Department</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {departments.map((dept) => (
            <button
              type="button"
              key={dept.id}
              onClick={() => setSelectedDepartment(dept.id)}
              className={`rounded-sm border px-3 py-2 text-sm ${
                selectedDepartment === dept.id
                  ? 'border-amber-500 bg-amber-500/10 text-ink-950'
                  : 'border-ink-700/20 text-ink-700'
              }`}
            >
              {dept.name}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-display text-base font-semibold">Level</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {levels.map((level) => (
            <button
              type="button"
              key={level.id}
              onClick={() => setSelectedLevel(level.id)}
              className={`rounded-sm border px-3 py-2 text-sm ${
                selectedLevel === level.id
                  ? 'border-amber-500 bg-amber-500/10 text-ink-950'
                  : 'border-ink-700/20 text-ink-700'
              }`}
            >
              {level.name}
            </button>
          ))}
        </div>
      </fieldset>

      {message && <p className="text-sm text-red-600">{message}</p>}
      {success && <p className="text-sm text-emerald-600">Saved.</p>}

      <button
        type="submit"
        disabled={submitting || !selectedDepartment || !selectedLevel}
        className="self-start rounded-sm bg-ink-950 px-4 py-3 text-sm font-medium text-paper-50 hover:bg-ink-900 disabled:opacity-40"
      >
        {submitting ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}
