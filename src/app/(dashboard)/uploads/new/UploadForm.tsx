'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, MIME_TO_FILE_TYPE } from '@/lib/validation/upload';
import { BackLink } from '@/components/nav/BackLink';
import { displaySemester } from '@/lib/semester';

type Course = { id: string; code: string; title: string; semester: string };

interface UploadFormProps {
  hideHeader?: boolean;
  onRequestCourse?: () => void;
}

export default function UploadForm({
  hideHeader = false,
  onRequestCourse,
}: UploadFormProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseSearch, setCourseSearch] = useState('');
  const [courseId, setCourseId] = useState('');
  const [resourceType, setResourceType] = useState<'notes' | 'test1' | 'test2' | 'assignment' | 'exam' | 'other'>('notes');
  const [label, setLabel] = useState('');
  const [academicYear, setAcademicYear] = useState('2024/2025');
  const [isLink, setIsLink] = useState(false);
  const [externalUrl, setExternalUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function init() {
      const { data } = await supabase
        .from('courses')
        .select('id, code, title, semester')
        .eq('status', 'approved')
        .order('code');
      setCourses(data ?? []);
      setLoading(false);
    }
    init();
  }, [supabase]);

  const filteredCourses = courses.filter(
    (c) =>
      c.code.toLowerCase().includes(courseSearch.toLowerCase()) ||
      c.title.toLowerCase().includes(courseSearch.toLowerCase())
  );

  const selectedCourse = courses.find((c) => c.id === courseId) ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!courseId) {
      setMessage('Pick a course first.');
      return;
    }
    if (isLink && !externalUrl) {
      setMessage('Paste a link.');
      return;
    }
    if (!isLink && !file) {
      setMessage('Choose a file.');
      return;
    }
    if (!isLink && file && !ALLOWED_MIME_TYPES.includes(file.type)) {
      setMessage("That file type isn't supported. Use PDF, DOCX, PPTX, or an image — videos must be a link instead.");
      return;
    }
    if (!isLink && file && file.size > MAX_FILE_SIZE_BYTES) {
      setMessage('File is too large (25MB max).');
      return;
    }

    setSubmitting(true);

    let storagePath: string | undefined;
    let fileSizeBytes: number | undefined;
    let fileType: 'pdf' | 'docx' | 'pptx' | 'image' | 'link' = 'link';

    if (!isLink && file) {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;
      const safeName = file.name.replace(/[^a-zA-Z0-9.\- ]/g, '').trim();
      storagePath = `${uid}/${courseId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('uploads-pending')
        .upload(storagePath, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        setSubmitting(false);
        setMessage(`Upload failed: ${uploadError.message}`);
        return;
      }

      fileSizeBytes = file.size;
      fileType = MIME_TO_FILE_TYPE[file.type];
    }

    // No semester field here — the selected course already has one fixed
    // at creation, and the API reads it off the course row directly.
    const res = await fetch('/api/uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId,
        fileType,
        resourceType,
        label: label || undefined,
        academicYear,
        externalUrl: isLink ? externalUrl : undefined,
        storagePath,
        fileSizeBytes,
      }),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setMessage(typeof data.error === 'string' ? data.error : 'Something went wrong submitting the upload.');
      return;
    }

    setSuccess(true);
  }

  if (loading) {
    return <p className="text-sm text-ink-700">Loading…</p>;
  }

  if (success) {
    return (
      <div className="text-center text-ink-950">
        <h1 className="font-display text-2xl font-semibold">Submitted</h1>
        <p className="mt-2 text-sm text-ink-700">
          Your upload is in the review queue. You'll be notified once a
          reviewer approves or rejects it — unless you have auto-approve
          rights for this course, in which case it's already public.
        </p>
        <button
          onClick={() => (window.location.href = '/')}
          className="mt-6 rounded-sm bg-ink-950 px-4 py-3 text-sm font-medium text-paper-50 hover:bg-ink-900"
        >
          Back to the archive
        </button>
      </div>
    );
  }

  return (
    <div className="text-ink-950">
      {!hideHeader && (
        <>
          <BackLink fallbackHref="/" label="Back" />
          <h1 className="mt-4 font-display text-2xl font-semibold">Upload a resource</h1>
        </>
      )}
      <p className={hideHeader ? 'text-sm text-ink-700' : 'mt-2 text-sm text-ink-700'}>
        Don't see the course you're looking for?{' '}
        {onRequestCourse ? (
          <button
            type="button"
            onClick={onRequestCourse}
            className="underline hover:text-amber-600"
          >
            Request a new course folder
          </button>
        ) : (
          <a href="/courses/new?returnTo=/uploads/new" className="underline hover:text-amber-600">
            Request a new course folder
          </a>
        )}{' '}
        — it'll need approval first, but you won't lose your place; come back
        here once it's live.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Course
          <input
            type="text"
            placeholder="Search by code or title…"
            value={courseSearch}
            onChange={(e) => setCourseSearch(e.target.value)}
            className="rounded-sm border border-ink-700/20 px-4 py-3"
          />
          <select
            required
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            size={Math.min(6, Math.max(3, filteredCourses.length))}
            className="mt-1 rounded-sm border border-ink-700/20 px-4 py-2"
          >
            {filteredCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.title}
              </option>
            ))}
          </select>
        </label>

        {selectedCourse && (
          <p className="-mt-2 text-xs text-ink-700/60">
            {selectedCourse.code} is an {displaySemester(selectedCourse.semester)} Semester course —
            this upload will be filed under that semester automatically.
          </p>
        )}

        <label className="flex flex-col gap-1 text-sm">
          Resource type
          <select
            value={resourceType}
            onChange={(e) => setResourceType(e.target.value as typeof resourceType)}
            className="rounded-sm border border-ink-700/20 px-4 py-3"
          >
            <option value="notes">Notes</option>
            <option value="test1">Test 1</option>
            <option value="test2">Test 2</option>
            <option value="assignment">Assignment</option>
            <option value="exam">Exam</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Label (topic name, or test/assignment number)
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Linked Lists — or just '1'"
            className="rounded-sm border border-ink-700/20 px-4 py-3"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Academic year
          <input
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            placeholder="2024/2025"
            className="rounded-sm border border-ink-700/20 px-4 py-3"
          />
        </label>

        <div className="flex items-center gap-2 text-sm">
          <input
            id="isLink"
            type="checkbox"
            checked={isLink}
            onChange={(e) => setIsLink(e.target.checked)}
          />
          <label htmlFor="isLink">This is a video/external link, not a file</label>
        </div>

        {isLink ? (
          <label className="flex flex-col gap-1 text-sm">
            Link
            <input
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://youtube.com/…"
              className="rounded-sm border border-ink-700/20 px-4 py-3"
            />
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-sm">
            File (PDF, DOCX, PPTX, or image — 25MB max)
            <input
              type="file"
              accept=".pdf,.docx,.pptx,.png,.jpg,.jpeg"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="rounded-sm border border-ink-700/20 px-4 py-3"
            />
          </label>
        )}

        {message && <p className="text-sm text-red-600">{message}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-sm bg-ink-950 px-4 py-3 text-sm font-medium text-paper-50 hover:bg-ink-900 disabled:opacity-40"
        >
          {submitting ? 'Uploading…' : 'Submit'}
        </button>
      </form>
    </div>
  );
}
