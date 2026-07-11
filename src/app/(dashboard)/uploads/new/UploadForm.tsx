'use client';

import { useEffect, useState } from 'react';
import imageCompression from 'browser-image-compression';
import { createClient } from '@/lib/supabase/client';
import {
  ALLOWED_MIME_TYPES,
  IMAGE_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
  MIME_TO_FILE_TYPE,
} from '@/lib/validation/upload';
import { BackLink } from '@/components/nav/BackLink';
import { displaySemester } from '@/lib/semester';

type Course = { id: string; code: string; title: string; semester: string };

interface UploadFormProps {
  hideHeader?: boolean;
  onRequestCourse?: () => void;
}

// Target for compressed images — deliberately well under MAX_FILE_SIZE_BYTES
// so a compressed image essentially never gets rejected by the size check
// that runs afterward.
const IMAGE_COMPRESSION_TARGET_MB = 2;

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
  const [compressing, setCompressing] = useState(false);
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

  const selectedCourse = courses.find((c) => c.id === courseId) ?? null;

  // Only computed (and only shown) while there's active search text and
  // nothing picked yet — this is a search-as-you-type suggestion list, not
  // a permanently visible catalog.
  const filteredCourses = courseSearch.trim()
    ? courses.filter(
        (c) =>
          c.code.toLowerCase().includes(courseSearch.toLowerCase()) ||
          c.title.toLowerCase().includes(courseSearch.toLowerCase())
      )
    : [];

  function handlePickCourse(c: Course) {
    setCourseId(c.id);
    setCourseSearch('');
  }

  function handleChangeCourse() {
    setCourseId('');
    setCourseSearch('');
  }

  // Runs the moment a file is picked, not at submit time, so the person sees
  // "compressing…" feedback right away and the size check that follows in
  // handleSubmit already sees the compressed file.
  async function handleFileChange(picked: File | null) {
    setMessage(null);
    if (!picked) {
      setFile(null);
      return;
    }

    if (!IMAGE_MIME_TYPES.includes(picked.type)) {
      setFile(picked);
      return;
    }

    setCompressing(true);
    try {
      const compressed = await imageCompression(picked, {
        maxSizeMB: IMAGE_COMPRESSION_TARGET_MB,
        maxWidthOrHeight: 2200,
        useWebWorker: true,
        // Preserve the original mime type (png stays png, jpg stays jpg)
        // rather than the library's default of converting everything to jpeg.
        fileType: picked.type,
      });

      // imageCompression returns a Blob — rewrap as a File so downstream
      // code (name, type) keeps working exactly like a picked file.
      const recompressedFile = new File([compressed], picked.name, {
        type: picked.type,
        lastModified: Date.now(),
      });

      setFile(recompressedFile);
    } catch (err) {
      // If compression fails for any reason, fall back to the original file
      // rather than blocking the upload entirely — the size check below
      // will still catch anything too large.
      console.error('Image compression failed, using original file:', err);
      setFile(picked);
    } finally {
      setCompressing(false);
    }
  }

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
      const isImage = IMAGE_MIME_TYPES.includes(file.type);
      setMessage(
        isImage
          ? `Image is still too large after compression (${MAX_FILE_SIZE_MB}MB max). Try a smaller photo.`
          : `File is too large (${MAX_FILE_SIZE_MB}MB max). Try re-exporting at a lower quality or splitting it into parts.`
      );
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
          {selectedCourse ? (
            <div className="flex items-center justify-between rounded-sm border border-ink-700/20 px-4 py-3">
              <span>
                {selectedCourse.code} — {selectedCourse.title}
              </span>
              <button
                type="button"
                onClick={handleChangeCourse}
                className="text-xs font-medium text-amber-600 underline"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                placeholder="Search by code or title…"
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                className="w-full rounded-sm border border-ink-700/20 px-4 py-3"
              />
              {courseSearch.trim() && (
                <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-sm border border-ink-700/20 bg-paper-50 shadow-md">
                  {filteredCourses.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-ink-700/60">No matching courses.</p>
                  ) : (
                    filteredCourses.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handlePickCourse(c)}
                        className="block w-full px-4 py-2 text-left text-sm hover:bg-amber-500/10"
                      >
                        {c.code} — {c.title}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
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
            File (PDF, DOCX, PPTX, or image — {MAX_FILE_SIZE_MB}MB max)
            <input
              type="file"
              accept=".pdf,.docx,.pptx,.png,.jpg,.jpeg"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              className="rounded-sm border border-ink-700/20 px-4 py-3"
            />
            {compressing && (
              <span className="text-xs text-ink-700/60">Compressing image…</span>
            )}
          </label>
        )}

        {message && <p className="text-sm text-red-600">{message}</p>}

        <button
          type="submit"
          disabled={submitting || compressing}
          className="rounded-sm bg-ink-950 px-4 py-3 text-sm font-medium text-paper-50 hover:bg-ink-900 disabled:opacity-40"
        >
          {submitting ? 'Uploading…' : compressing ? 'Compressing…' : 'Submit'}
        </button>
      </form>
    </div>
  );
}
