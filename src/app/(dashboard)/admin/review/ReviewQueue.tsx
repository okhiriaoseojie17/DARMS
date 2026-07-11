'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BackLink } from '@/components/nav/BackLink';
import { displaySemester } from '@/lib/semester';

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

type CourseGroup = {
  courseId: string;
  code: string;
  title: string;
  items: PendingUpload[];
};

export default function ReviewQueue({
  userId,
  hideHeader = false,
}: {
  userId: string;
  hideHeader?: boolean;
}) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [uploaderNames, setUploaderNames] = useState<Record<string, string>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Bulk-selection state — a Set of upload ids checked across any/all groups.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkRejecting, setBulkRejecting] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');

  async function loadQueue() {
    const { data: perms } = await supabase
      .from('permission_assignments')
      .select('revoked_at, permissions(key)')
      .eq('profile_id', userId);

    const detectedAccess = (perms ?? []).some((row: any) => {
      const permsForRow = Array.isArray(row.permissions) ? row.permissions : [row.permissions];
      return (
        row.revoked_at === null &&
        permsForRow.some((p: any) => p && ['approve_uploads', 'reject_uploads'].includes(p.key))
      );
    });
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

  // Group pending uploads by course — this is purely a display grouping,
  // it doesn't change what's fetched or how approve/reject are authorized
  // (that's still per-row, via RLS on each individual API call).
  const groups: CourseGroup[] = useMemo(() => {
    const map = new Map<string, CourseGroup>();
    for (const upload of uploads) {
      const key = upload.course_id ?? 'unknown';
      if (!map.has(key)) {
        map.set(key, {
          courseId: key,
          code: upload.courses?.code ?? 'Unlinked',
          title: upload.courses?.title ?? 'Course not linked',
          items: [],
        });
      }
      map.get(key)!.items.push(upload);
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [uploads]);

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleGroup(items: PendingUpload[], checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      items.forEach((u) => (checked ? next.add(u.id) : next.delete(u.id)));
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(uploads.map((u) => u.id)) : new Set());
  }

  function clearSelectionState() {
    setBulkRejecting(false);
    setBulkRejectReason('');
  }

  async function handleApprove(id: string) {
    setBusyId(id);
    setMessage(null);
    const res = await fetch(`/api/uploads/${id}/approve`, { method: 'POST' });
    const data = await res.json();
    setBusyId(null);

    // Treat 207 Multi-Status as a warning, not a full success — the status
    // update went through but the file move to the approved bucket failed,
    // so the download link would 404 if we silently treated this as clean.
    if (res.status === 207) {
      setMessage(data.warning ?? 'Approved, but the file move failed — check storage.');
      setUploads((prev) => prev.filter((u) => u.id !== id));
      return;
    }
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

  // Bulk actions reuse the same per-id API routes (each call is still
  // individually gated by RLS) rather than a new batch endpoint — this
  // keeps authorization exactly as strict as the single-item flow, just
  // fired concurrently instead of one at a time.
  async function handleBulkApprove() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkBusy(true);
    setMessage(null);

    const outcomes = await Promise.allSettled(
      ids.map(async (id) => {
        const res = await fetch(`/api/uploads/${id}/approve`, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        return { id, ok: res.ok || res.status === 207, warned: res.status === 207, data };
      })
    );

    const succeeded: string[] = [];
    let warnedCount = 0;
    let failedCount = 0;

    outcomes.forEach((outcome, i) => {
      if (outcome.status === 'fulfilled' && outcome.value.ok) {
        succeeded.push(outcome.value.id);
        if (outcome.value.warned) warnedCount += 1;
      } else {
        failedCount += 1;
      }
      void i;
    });

    setUploads((prev) => prev.filter((u) => !succeeded.includes(u.id)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      succeeded.forEach((id) => next.delete(id));
      return next;
    });

    if (failedCount > 0) {
      setMessage(
        `${succeeded.length} approved, ${failedCount} failed — likely outside your scope. Refresh and try those individually.`
      );
    } else if (warnedCount > 0) {
      setMessage(`${succeeded.length} approved, but ${warnedCount} file move(s) failed — check storage.`);
    } else {
      setMessage(`${succeeded.length} upload${succeeded.length === 1 ? '' : 's'} approved.`);
    }
    setBulkBusy(false);
  }

  async function handleBulkReject() {
    if (!bulkRejectReason.trim()) {
      setMessage('A rejection reason is required for the selected uploads.');
      return;
    }
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkBusy(true);
    setMessage(null);

    const outcomes = await Promise.allSettled(
      ids.map(async (id) => {
        const res = await fetch(`/api/uploads/${id}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: bulkRejectReason }),
        });
        return { id, ok: res.ok };
      })
    );

    const succeeded: string[] = [];
    let failedCount = 0;
    outcomes.forEach((outcome) => {
      if (outcome.status === 'fulfilled' && outcome.value.ok) succeeded.push(outcome.value.id);
      else failedCount += 1;
    });

    setUploads((prev) => prev.filter((u) => !succeeded.includes(u.id)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      succeeded.forEach((id) => next.delete(id));
      return next;
    });

    if (failedCount > 0) {
      setMessage(
        `${succeeded.length} rejected, ${failedCount} failed — likely outside your scope. Refresh and try those individually.`
      );
    } else {
      setMessage(`${succeeded.length} upload${succeeded.length === 1 ? '' : 's'} rejected.`);
    }
    clearSelectionState();
    setBulkBusy(false);
  }

  if (loading) {
    return <p className="text-sm text-ink-700">Loading…</p>;
  }

  if (!hasAccess) {
    return (
      <div className="text-center text-ink-950">
        {!hideHeader && <BackLink fallbackHref="/" label="Back" />}
        <h1 className="mt-6 font-display text-2xl font-semibold">No review access</h1>
        <p className="mt-2 text-sm text-ink-700">
          You don't currently hold approve/reject permissions for any course.
          If you should, ask a department administrator to grant it.
        </p>
      </div>
    );
  }

  const allSelected = uploads.length > 0 && selectedIds.size === uploads.length;
  const selectedCount = selectedIds.size;

  return (
    <div className="text-ink-950">
      {!hideHeader && (
        <>
          <BackLink fallbackHref="/" label="Back" />
          <h1 className="mt-4 font-display text-2xl font-semibold">Review queue</h1>
        </>
      )}
      <p className={hideHeader ? 'text-sm text-ink-700' : 'mt-2 text-sm text-ink-700'}>
        Showing pending uploads within your scope — {uploads.length} waiting, grouped by course.
      </p>

      {message && <p className="mt-4 text-sm text-red-600">{message}</p>}

      {uploads.length === 0 && (
        <p className="mt-10 text-ink-700/60">Nothing pending right now.</p>
      )}

      {uploads.length > 0 && (
        <div className="sticky top-0 z-10 mt-6 flex flex-wrap items-center gap-3 rounded-sm border border-ink-700/15 bg-paper-50 p-3">
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-ink-950"
              checked={allSelected}
              onChange={(e) => toggleAll(e.target.checked)}
            />
            Select all
          </label>
          <span className="text-sm text-ink-700/70">
            {selectedCount > 0 ? `${selectedCount} selected` : 'None selected'}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              disabled={selectedCount === 0 || bulkBusy}
              onClick={handleBulkApprove}
              className="rounded-sm bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
            >
              {bulkBusy ? 'Working…' : `Approve selected${selectedCount > 0 ? ` (${selectedCount})` : ''}`}
            </button>
            <button
              type="button"
              disabled={selectedCount === 0 || bulkBusy}
              onClick={() => setBulkRejecting((v) => !v)}
              className="rounded-sm border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
            >
              Reject selected{selectedCount > 0 ? ` (${selectedCount})` : ''}
            </button>
          </div>

          {bulkRejecting && (
            <div className="flex w-full gap-2 border-t border-ink-700/10 pt-3">
              <input
                type="text"
                placeholder="Reason applied to all selected rejections (required)"
                value={bulkRejectReason}
                onChange={(e) => setBulkRejectReason(e.target.value)}
                className="flex-1 rounded-sm border border-ink-700/20 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleBulkReject}
                disabled={bulkBusy}
                className="rounded-sm bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
              >
                Confirm reject
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-8">
        {groups.map((group) => {
          const groupSelected = group.items.every((u) => selectedIds.has(u.id));
          const groupPartial = !groupSelected && group.items.some((u) => selectedIds.has(u.id));

          return (
            <div key={group.courseId}>
              <div className="flex items-center gap-3 border-b border-ink-700/15 pb-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-ink-950"
                  checked={groupSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = groupPartial;
                  }}
                  onChange={(e) => toggleGroup(group.items, e.target.checked)}
                />
                <div>
                  <p className="font-display text-lg">
                    {group.code} <span className="text-ink-700/70">— {group.title}</span>
                  </p>
                  <p className="text-xs text-ink-700/70">
                    {group.items.length} pending upload{group.items.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-4">
                {group.items.map((upload) => (
                  <div key={upload.id} className="rounded-sm border border-ink-700/15 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-ink-950"
                          checked={selectedIds.has(upload.id)}
                          onChange={(e) => toggleOne(upload.id, e.target.checked)}
                        />
                        <div>
                          <p className="font-mono text-xs text-ink-700">
                            {upload.academic_year} · {displaySemester(upload.semester)} Semester
                          </p>
                          <p className="mt-1 font-display text-lg">{upload.generated_filename}</p>
                          <p className="mt-1 text-sm text-ink-700">
                            Uploaded by {uploaderNames[upload.uploader_id] ?? 'a student'} ·{' '}
                            {new Date(upload.created_at).toLocaleDateString()} · {upload.file_type}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => handleApprove(upload.id)}
                          disabled={busyId === upload.id || bulkBusy}
                          className="rounded-sm bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setRejectingId(rejectingId === upload.id ? null : upload.id)}
                          disabled={bulkBusy}
                          className="rounded-sm border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
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
        })}
      </div>
    </div>
  );
}
