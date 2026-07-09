'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Department = { id: string; name: string; code: string };
type Level = { id: string; name: string };

export default function OnboardingForm({ userId }: { userId: string }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [profileType, setProfileType] = useState<'student' | 'lecturer' | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [courseCodesInput, setCourseCodesInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [notFoundCourses, setNotFoundCourses] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function init() {
      const [{ data: deptData }, { data: levelData }] = await Promise.all([
        supabase.from('departments').select('*').order('name'),
        supabase.from('levels').select('*').order('sort_order'),
      ]);
      setDepartments(deptData ?? []);
      setLevels(levelData ?? []);
      setLoading(false);
    }
    init();
  }, [supabase]);

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);

    const courseCodes = courseCodesInput
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    const res = await fetch('/api/profile/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileType,
        departmentIds: selectedDepartments,
        levelIds: selectedLevels,
        courseCodes: profileType === 'lecturer' ? courseCodes : undefined,
      }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setMessage(typeof data.error === 'string' ? data.error : 'Something went wrong — check your selections.');
      return;
    }

    if (data.notFoundCourses?.length > 0) {
      setNotFoundCourses(data.notFoundCourses);
      return;
    }

    window.location.href = '/';
  }

  if (loading) {
    return <p className="text-sm text-paper-200/60">Loading…</p>;
  }

  if (notFoundCourses.length > 0) {
    return (
      <div className="text-ink-950">
        <h1 className="font-display text-2xl font-semibold">Almost done</h1>
        <p className="mt-3 text-sm text-ink-700">
          Everything else was saved. These course codes don't exist in the
          system yet, so they couldn't be linked to you:
        </p>
        <ul className="mt-2 list-inside list-disc text-sm font-mono text-ink-700">
          {notFoundCourses.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-ink-700">
          Once a department administrator creates those courses, come back and
          we can link them to you — for now, continue to the archive.
        </p>
        <button
          onClick={() => (window.location.href = '/')}
          className="mt-6 rounded-sm bg-ink-950 px-4 py-3 text-sm font-medium text-paper-50 hover:bg-ink-900"
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="text-ink-950">
      <h1 className="font-display text-2xl font-semibold">A couple of quick questions</h1>
      <p className="mt-2 text-sm text-ink-700">
        This helps route your uploads to the right reviewers and shows you the
        right courses by default.
      </p>

      {!profileType && (
        <div className="mt-8 flex gap-3">
          <button
            onClick={() => setProfileType('student')}
            className="flex-1 rounded-sm border border-ink-700/20 p-6 text-left hover:border-amber-500"
          >
            <p className="font-display text-lg">I'm a student</p>
            <p className="mt-1 text-sm text-ink-700">I want to browse and contribute resources.</p>
          </button>
          <button
            onClick={() => setProfileType('lecturer')}
            className="flex-1 rounded-sm border border-ink-700/20 p-6 text-left hover:border-amber-500"
          >
            <p className="font-display text-lg">I'm a lecturer</p>
            <p className="mt-1 text-sm text-ink-700">I teach one or more courses.</p>
          </button>
        </div>
      )}

      {profileType && (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
          <fieldset>
            <legend className="font-display text-base font-semibold">
              {profileType === 'student' ? 'Your department' : 'Department(s) you teach in'}
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {departments.map((dept) => (
                <button
                  type="button"
                  key={dept.id}
                  onClick={() => toggle(selectedDepartments, setSelectedDepartments, dept.id)}
                  className={`rounded-sm border px-3 py-2 text-sm ${
                    selectedDepartments.includes(dept.id)
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
            <legend className="font-display text-base font-semibold">
              {profileType === 'student' ? 'Your level' : 'Level(s) you teach'}
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {levels.map((level) => (
                <button
                  type="button"
                  key={level.id}
                  onClick={() => toggle(selectedLevels, setSelectedLevels, level.id)}
                  className={`rounded-sm border px-3 py-2 text-sm ${
                    selectedLevels.includes(level.id)
                      ? 'border-amber-500 bg-amber-500/10 text-ink-950'
                      : 'border-ink-700/20 text-ink-700'
                  }`}
                >
                  {level.name}
                </button>
              ))}
            </div>
          </fieldset>

          {profileType === 'lecturer' && (
            <fieldset>
              <legend className="font-display text-base font-semibold">Courses you teach</legend>
              <p className="mt-1 text-xs text-ink-700/70">
                Comma-separated course codes, e.g. CSC201, CSC301. If a course
                isn't in the system yet, that's fine — we'll flag it.
              </p>
              <input
                type="text"
                value={courseCodesInput}
                onChange={(e) => setCourseCodesInput(e.target.value)}
                placeholder="CSC201, CSC301"
                className="mt-2 w-full rounded-sm border border-ink-700/20 px-4 py-3 text-sm"
              />
            </fieldset>
          )}

          {message && <p className="text-sm text-red-600">{message}</p>}

          <button
            type="submit"
            disabled={submitting || selectedDepartments.length === 0 || selectedLevels.length === 0}
            className="rounded-sm bg-ink-950 px-4 py-3 text-sm font-medium text-paper-50 hover:bg-ink-900 disabled:opacity-40"
          >
            {submitting ? 'Saving…' : 'Finish'}
          </button>
        </form>
      )}
    </div>
  );
}
