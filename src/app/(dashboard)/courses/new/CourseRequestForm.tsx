'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BackLink } from '@/components/nav/BackLink';
import { displaySemester } from '@/lib/semester';

type Department = { id: string; name: string; code: string };
type Level = { id: string; name: string };
type CourseRequest = {
  id: string;
  code: string;
  title: string;
  status: string;
  decision_reason: string | null;
  created_at: string;
};

interface CourseRequestFormProps {
  hideHeader?: boolean;
  onBackToUpload?: () => void;
}

export default function CourseRequestForm({
  hideHeader = false,
  onBackToUpload,
}: CourseRequestFormProps) {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [myRequests, setMyRequests] = useState<CourseRequest[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [levelId, setLevelId] = useState('');
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [semester, setSemester] = useState<'First' | 'Second'>('First');
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [justSubmitted, setJustSubmitted] = useState(false);

  useEffect(() => {
    async function init() {
      const [{ data: deptData }, { data: levelData }, { data: requests }] = await Promise.all([
        supabase.from('departments').select('*').order('name'),
        supabase.from('levels').select('*').order('sort_order'),
        supabase
          .from('course_creation_requests')
          .select('*')
          .neq('status', 'approved')
          .order('created_at', { ascending: false }),
      ]);

      setDepartments(deptData ?? []);
      setLevels(levelData ?? []);
      setMyRequests(requests ?? []);
      setLoading(false);
    }
    init();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);

    const res = await fetch('/api/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ departmentId, levelId, code: code.toUpperCase(), title, semester }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      const errorText =
        typeof data.error === 'string'
          ? data.error
          : data.error?.fieldErrors?.code?.[0] || 'Something went wrong — check the course code format (e.g. CSC201).';
      setMessage(errorText);
      return;
    }

    setMyRequests([data.request, ...myRequests]);
    setCode('');
    setTitle('');
    setJustSubmitted(true);
  }

  if (loading) {
    return <p className="text-sm text-ink-700">Loading…</p>;
  }

  if (justSubmitted) {
    return (
      <div className="text-ink-950">
        <h1 className="font-display text-2xl font-semibold">Request submitted</h1>
        <p className="mt-2 text-sm text-ink-700">
          A department administrator will review it. You'll be able to upload
          to this course once it's approved.
        </p>
        {onBackToUpload ? (
          <button
            onClick={onBackToUpload}
            className="mt-6 rounded-sm bg-ink-950 px-4 py-3 text-sm font-medium text-paper-50 hover:bg-ink-900"
          >
            Back to your upload
          </button>
        ) : returnTo ? (
          <button
            onClick={() => (window.location.href = returnTo)}
            className="mt-6 rounded-sm bg-ink-950 px-4 py-3 text-sm font-medium text-paper-50 hover:bg-ink-900"
          >
            Back to your upload
          </button>
        ) : (
          <button
            onClick={() => setJustSubmitted(false)}
            className="mt-6 rounded-sm bg-ink-950 px-4 py-3 text-sm font-medium text-paper-50 hover:bg-ink-900"
          >
            Request another
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="text-ink-950">
      {!hideHeader && (
        <>
          <BackLink fallbackHref={returnTo ?? '/'} label={returnTo ? 'Back to upload' : 'Back'} />
          <h1 className="mt-4 font-display text-2xl font-semibold">Request a new course folder</h1>
          <p className="mt-2 text-sm text-ink-700">
            Course folders go through review before they're public — this doesn't
            create the course immediately, it submits a request.
          </p>
        </>
      )}

      <form onSubmit={handleSubmit} className={`${hideHeader ? 'mt-2' : 'mt-8'} flex flex-col gap-4`}>
        <label className="flex flex-col gap-1 text-sm">
          Department
          <select
            required
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="rounded-sm border border-ink-700/20 px-4 py-3"
          >
            <option value="" disabled>
              Select a department
            </option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Level
          <select
            required
            value={levelId}
            onChange={(e) => setLevelId(e.target.value)}
            className="rounded-sm border border-ink-700/20 px-4 py-3"
          >
            <option value="" disabled>
              Select a level
            </option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Course code
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="CSC201"
            className="rounded-sm border border-ink-700/20 px-4 py-3 font-mono uppercase"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Course title
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Data Structures"
            className="rounded-sm border border-ink-700/20 px-4 py-3"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Semester
          <select
            value={semester}
            onChange={(e) => setSemester(e.target.value as 'First' | 'Second')}
            className="rounded-sm border border-ink-700/20 px-4 py-3"
          >
            <option value="First">{displaySemester('First')}</option>
            <option value="Second">{displaySemester('Second')}</option>
          </select>
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-sm bg-ink-950 px-4 py-3 text-sm font-medium text-paper-50 hover:bg-ink-900 disabled:opacity-40"
        >
          {submitting ? 'Submitting…' : 'Submit request'}
        </button>
      </form>

      {message && <p className="mt-4 text-sm text-red-600">{message}</p>}

      {myRequests.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-lg font-semibold">Your requests</h2>
          <div className="mt-3 flex flex-col gap-2">
            {myRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between rounded-sm border border-ink-700/15 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-mono text-xs text-ink-700">{req.code}</p>
                  <p>{req.title}</p>
                </div>
                <span
                  className={`rounded-sm px-2 py-1 text-xs font-medium uppercase ${
                    req.status === 'approved'
                      ? 'bg-green-100 text-green-800'
                      : req.status === 'rejected'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {req.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
