'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { displaySemester } from '@/lib/semester';

type ApprovedUpload = {
  id: string;
  generated_filename: string;
  file_type: string;
  academic_year: string;
  semester: string;
  uploader_id: string;
  course_id: string;
  created_at: string;
  courses: { code: string; title: string } | null;
};

export default function ManageUploads({ userId }: { userId: string }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [uploads, setUploads] = useState<ApprovedUpload[]>([]);
  const [uploaderNames, setUploaderNames] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadUploads() {
    const { data: perms } = await supabase
      .from('permission_assignments')
      .select('revoked_at, permissions(key)')
      .eq('profile_id', userId);

    const detectedAccess = (perms ?? []).some((row: any) => {
      const permsForRow = Array.isArray(row.permissions) ? row.permissions : [row.permissions];
      return row.revoked_at === null && permsForRow.some((p: any) => p?.key === 'delete_uploads');
    });
    setHasAccess(detectedAccess);

    if (!detectedAccess) {
      setLoading(false);
      return;
    }

    // This intentionally lists status='approved' only — these are the files
    // actually live on the public site right now, which is the specific
    // thing this tab exists to let an admin clean up.
    const { data: approved } = await supabase
      .from('uploads')
      .select('*, courses(code, title)')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    setUploads((approved as any) ?? []);

    const uploaderIds = Array.from(new Set((approved ?? []).map((u: any) => u.uploader_id)));
    if (uploaderIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', uploaderIds);
      const nameMap: Record<string, string> = {};
      (profiles ?? []).forEach((p) => (nameMap[p.id] = p.display_name));
      setUploaderNames(nameMap);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadUploads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleDelete(id: string, filename: string) {
    if (
      !window.confirm(
        `Delete "${filename}" permanently? This removes the file from Supabase Storage right away — there's no undo.`
      )
    ) {
      return;
    }
    setBusyId(id);
    setMessage(null);
    const res = await fetch(`/api/uploads/${id}/delete`, { method: 'POST' });
    const data = await res.json();
    setBusyId(null);

    if (res.status === 207) {
      setMessage(data.warning ?? 'Removed from the site, but storage cleanup failed — check Supabase.');
      setUploads((prev) => prev.filter((u) => u.id !== id));
      return;
    }
    if (!res.ok) {
      setMessage(data.error ?? 'Delete failed.');
      return;
    }
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }

  if (loading) {
    return <p className="text-sm text-ink-700">Loading…</p>;
  }

  if (!hasAccess) {
    return (
      <div className="text-center text-ink-950">
        <h1 className="mt-6 font-display text-2xl font-semibold">No delete access</h1>
        <p className="mt-2 text-sm text-ink-700">
          You don't currently hold delete permissions for any course.
          If you should, ask a department administrator to grant it.
        </p>
      </div>
    );
  }

  return (
    <div className="text-ink-950">
      <p className="text-sm text-ink-700">
        Live, approved uploads within your scope — {uploads.length} total.
        Deleting one removes it from the site immediately; the file itself
        gets purged by the retention job afterward, same as a rejected upload.
      </p>

      {message && <p className="mt-4 text-sm text-red-600">{message}</p>}

      {uploads.length === 0 && (
        <p className="mt-10 text-ink-700/60">No approved uploads in your scope.</p>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {uploads.map((upload) => (
          <div key={upload.id} className="rounded-sm border border-ink-700/15 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-ink-700">
                  {upload.courses?.code} · {upload.academic_year} · {displaySemester(upload.semester)} Semester
                </p>
                <p className="mt-1 font-display text-lg">{upload.generated_filename}</p>
                <p className="mt-1 text-sm text-ink-700">
                  Uploaded by {uploaderNames[upload.uploader_id] ?? 'a student'} ·{' '}
                  {new Date(upload.created_at).toLocaleDateString()} · {upload.file_type}
                </p>
              </div>
              <button
                onClick={() => handleDelete(upload.id, upload.generated_filename)}
                disabled={busyId === upload.id}
                className="shrink-0 rounded-sm border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
              >
                {busyId === upload.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
