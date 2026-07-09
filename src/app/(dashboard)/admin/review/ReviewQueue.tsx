'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BackLink } from '@/components/nav/BackLink';

type PendingUpload = {
  id: string;
  display_label: string;
  generated_filename: string;
  file_type: string;
  academic_year: string;
  semester: string;
  uploader_id: string;
  course_id: string;
  created_at: string;
  courses: { code: string; title: string } | null;
};

export default function ReviewQueue({ userId }: { userId: string }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [uploaderNames, setUploaderNames] = useState<Record<string, string>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadQueue() {
    // Fixed: the previous version filtered on an embedded table via
    // `.in('permissions.key', [...])`, which is fragile PostgREST syntax and
    // can silently return zero rows. Fetching the join plainly and filtering
    // in JS instead — guaranteed to behave the same regardless of
    // supabase-js/PostgREST version quirks.
    const { data: perms } = await supabase
      .from('permission_assignments')
      .select('revoked_at, permissions(key)')
      .eq('profile_id', userId);

    const detectedAccess = (perms ?? []).some(
      (row: any) =>
        row.revoked_at === null &&
        ['approve_uploads', 'reject_uploads'].includes(row.permissions?.key)
    );
    setHasAccess(detectedAccess);

    if (!detectedAccess) {
      setLoading(false);
      return;
    }

    const { data: pending } = await supabase
      .from('uploads')
      .select('*, courses(code, title)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    setUploads((pending as any) ?? []);

    const uploaderIds = Array.from(new Set((pending ?? []).map((u: any) => u.uploader_id)));
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
    loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleApprove(id: string) {
    setBusyId(id);
    setMessage(null);
    const res = await fetch(`/api/uploads/${id}/approve`, { method: 'POST' });
    const data = await res.json();
    setBusyId(null);

    if (!res.ok) {
      setMessage(data.error ?? 'Approval failed.');
      return;
    }
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) {
      setMessage('A rejection reason is required.');
      return;
    }
    setBusyId(id);
    setMessage(null);
    const res = await fetch(`/api/uploads/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: rejectReason }),
    });
    const data = await res.json();
    setBusyId(null);

    if (!res.ok) {
      setMessage(data.error ?? 'Rejection failed.');
      return;
    }
    setUploads((prev) => prev.filter((u) => u.id !== id));
    setRejectingId(null);
    setRejectReason('');
  }

  if (loading) {
    return <p className="text-sm text-ink-700">Loading…</p>;
  }

  if (!hasAccess) {
    return (
      <div className="text-center text-ink-950">
        <BackLink fallbackHref="/" label="Back" />
        <h1 className="mt-6 font-display text-2xl font-semibold">No review access</h1>
        <p className="mt-2 text-sm text-ink-700">
          You don't currently hold approve/reject permissions for any course.
          If you should, ask a department administrator to grant it.
        </p>
      </div>
    );
  }

  return (
    <div className="text-ink-950">
      <BackLink fallbackHref="/" label="Back" />
      <h1 className="mt-4 font-display text-2xl font-semibold">Review queue</h1>
      <p className="mt-2 text-sm text-ink-700">
        Showing pending uploads within your scope — {uploads.length} waiting.
      </p>

      {message && <p className="mt-4 text-sm text-red-600">{message}</p>}

      {uploads.length === 0 && (
        <p className="mt-10 text-ink-700/60">Nothing pending right now.</p>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {uploads.map((upload) => (
          <div key={upload.id} className="rounded-sm border border-ink-700/15 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-ink-700">
                  {upload.courses?.code} · {upload.academic_year} · {upload.semester} Semester
                </p>
                <p className="mt-1 font-display text-lg">{upload.generated_filename}</p>
                <p className="mt-1 text-sm text-ink-700">
                  Uploaded by {uploaderNames[upload.uploader_id] ?? 'a student'} ·{' '}
                  {new Date(upload.created_at).toLocaleDateString()} · {upload.file_type}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => handleApprove(upload.id)}
                  disabled={busyId === upload.id}
                  className="rounded-sm bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  onClick={() => setRejectingId(rejectingId === upload.id ? null : upload.id)}
                  className="rounded-sm border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  Reject
                </button>
              </div>
            </div>

            {rejectingId === upload.id && (
              <div className="mt-4 flex gap-2 border-t border-ink-700/10 pt-4">
                <input
                  type="text"
                  placeholder="Reason for rejection (required)"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="flex-1 rounded-sm border border-ink-700/20 px-3 py-2 text-sm"
                />
                <button
                  onClick={() => handleReject(upload.id)}
                  disabled={busyId === upload.id}
                  className="rounded-sm bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
                >
                  Confirm
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
