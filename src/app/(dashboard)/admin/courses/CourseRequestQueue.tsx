'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BackLink } from '@/components/nav/BackLink';
import { displaySemester } from '@/lib/semester';

type CourseRequest = {
  id: string;
  requested_by: string;
  department_id: string;
  level_id: string;
  code: string;
  title: string;
  semester: string;
  status: string;
  created_at: string;
  departments: { name: string } | null;
  levels: { name: string } | null;
};

type LevelGroup = {
  levelId: string;
  levelName: string;
  items: CourseRequest[];
};

type SemesterGroup = {
  semester: string;
  levelGroups: LevelGroup[];
};

// 'First'/'Second' are the stored values; displaySemester maps them to the
// product's current "Alpha"/"Omega" naming for anything shown to a person —
// this ordering keeps that same intended sequence when grouping.
const SEMESTER_ORDER = ['First', 'Second'];

export default function CourseRequestQueue({
  userId,
  hideHeader = false,
}: {
  userId: string;
  hideHeader?: boolean;
}) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [requests, setRequests] = useState<CourseRequest[]>([]);
  const [requesterNames, setRequesterNames] = useState<Record<string, string>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Bulk-selection state — a Set of request ids checked across any/all groups.
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
      return row.revoked_at === null && permsForRow.some((p: any) => p?.key === 'manage_courses');
    });
    setHasAccess(detectedAccess);

    if (!detectedAccess) {
      setLoading(false);
      return;
    }

    const { data: pending } = await supabase
      .from('course_creation_requests')
      .select('*, departments(name), levels(name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    setRequests((pending as any) ?? []);

    const requesterIds = Array.from(new Set((pending ?? []).map((r: any) => r.requested_by)));
    if (requesterIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', requesterIds);
      const nameMap: Record<string, string> = {};
      (profiles ?? []).forEach((p) => (nameMap[p.id] = p.display_name));
      setRequesterNames(nameMap);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Group pending course requests by semester and then by level.
  const groups: SemesterGroup[] = useMemo(() => {
    const semesterMap = new Map<string, Map<string, { name: string; items: CourseRequest[] }>>();

    for (const req of requests) {
      const semKey = req.semester ?? 'unknown';
      const lvlKey = req.level_id ?? 'unknown';
      const lvlName = req.levels?.name ?? 'Unknown Level';

      if (!semesterMap.has(semKey)) {
        semesterMap.set(semKey, new Map());
      }

      const levelMap = semesterMap.get(semKey)!;
      if (!levelMap.has(lvlKey)) {
        levelMap.set(lvlKey, { name: lvlName, items: [] });
      }

      levelMap.get(lvlKey)!.items.push(req);
    }

    return Array.from(semesterMap.entries())
      .sort((a, b) => {
        const ai = SEMESTER_ORDER.indexOf(a[0]);
        const bi = SEMESTER_ORDER.indexOf(b[0]);
        if (ai === -1 && bi === -1) return a[0].localeCompare(b[0]);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      })
      .map(([semester, levelMap]) => {
        const levelGroups = Array.from(levelMap.entries())
          .sort((a, b) => a[1].name.localeCompare(b[1].name))
          .map(([levelId, data]) => ({
            levelId,
            levelName: data.name,
            items: data.items,
          }));

        return { semester, levelGroups };
      });
  }, [requests]);

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleGroup(items: CourseRequest[], checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      items.forEach((r) => (checked ? next.add(r.id) : next.delete(r.id)));
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(requests.map((r) => r.id)) : new Set());
  }

  // Extracts all item IDs within a specific semester group for select-all checkings
  function getSemesterItems(semesterGroup: SemesterGroup): CourseRequest[] {
    return semesterGroup.levelGroups.flatMap((lg) => lg.items);
  }

  function clearSelectionState() {
    setBulkRejecting(false);
    setBulkRejectReason('');
  }

  async function handleApprove(id: string) {
    setBusyId(id);
    setMessage(null);
    const res = await fetch(`/api/courses/${id}/approve`, { method: 'POST' });
    const data = await res.json();
    setBusyId(null);

    if (!res.ok) {
      setMessage(data.error ?? 'Approval failed.');
      return;
    }
    setRequests((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) {
      setMessage('A rejection reason is required.');
      return;
    }
    setBusyId(id);
    setMessage(null);
    const res = await fetch(`/api/courses/${id}/reject`, {
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
    setRequests((prev) => prev.filter((r) => r.id !== id));
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
        const res = await fetch(`/api/courses/${id}/approve`, { method: 'POST' });
        return { id, ok: res.ok };
      })
    );

    const succeeded: string[] = [];
    let failedCount = 0;
    outcomes.forEach((outcome) => {
      if (outcome.status === 'fulfilled' && outcome.value.ok) succeeded.push(outcome.value.id);
      else failedCount += 1;
    });

    setRequests((prev) => prev.filter((r) => !succeeded.includes(r.id)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      succeeded.forEach((id) => next.delete(id));
      return next;
    });

    if (failedCount > 0) {
      setMessage(
        `${succeeded.length} approved, ${failedCount} failed — likely outside your scope. Refresh and try those individually.`
      );
    } else {
      setMessage(`${succeeded.length} request${succeeded.length === 1 ? '' : 's'} approved.`);
    }
    setBulkBusy(false);
  }

  async function handleBulkReject() {
    if (!bulkRejectReason.trim()) {
      setMessage('A rejection reason is required for the selected requests.');
      return;
    }
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkBusy(true);
    setMessage(null);

    const outcomes = await Promise.allSettled(
      ids.map(async (id) => {
        const res = await fetch(`/api/courses/${id}/reject`, {
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

    setRequests((prev) => prev.filter((r) => !succeeded.includes(r.id)));
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
      setMessage(`${succeeded.length} request${succeeded.length === 1 ? '' : 's'} rejected.`);
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
          You don't currently hold course-management permissions for any department.
          If you should, ask a department administrator to grant it.
        </p>
      </div>
    );
  }

  const allSelected = requests.length > 0 && selectedIds.size === requests.length;
  const selectedCount = selectedIds.size;

  return (
    <div className="text-ink-950">
      {!hideHeader && (
        <>
          <BackLink fallbackHref="/" label="Back" />
          <h1 className="mt-4 font-display text-2xl font-semibold">Course requests</h1>
        </>
      )}
      <p className={hideHeader ? 'text-sm text-ink-700' : 'mt-2 text-sm text-ink-700'}>
        Showing pending course folder requests — {requests.length} waiting, grouped by semester and level.
      </p>

      {message && <p className="mt-4 text-sm text-red-600">{message}</p>}

      {requests.length === 0 && (
        <p className="mt-10 text-ink-700/60">Nothing pending right now.</p>
      )}

      {requests.length > 0 && (
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

      <div className="mt-6 flex flex-col gap-10">
        {groups.map((group) => {
          const semesterItems = getSemesterItems(group);
          const groupSelected = semesterItems.every((r) => selectedIds.has(r.id));
          const groupPartial = !groupSelected && semesterItems.some((r) => selectedIds.has(r.id));

          return (
            <div key={group.semester}>
              <div className="flex items-center gap-3 border-b border-ink-700/15 pb-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-ink-950"
                  checked={groupSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = groupPartial;
                  }}
                  onChange={(e) => toggleGroup(semesterItems, e.target.checked)}
                />
                <div>
                  <p className="font-display text-lg">{displaySemester(group.semester)} Semester</p>
                  <p className="text-xs text-ink-700/70">
                    {semesterItems.length} pending request{semesterItems.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-6 pl-4 border-l-2 border-ink-700/5">
                {group.levelGroups.map((levelGroup) => {
                  const levelSelected = levelGroup.items.every((r) => selectedIds.has(r.id));
                  const levelPartial = !levelSelected && levelGroup.items.some((r) => selectedIds.has(r.id));

                  return (
                    <div key={levelGroup.levelId}>
                      <div className="flex items-center gap-3 mb-3">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-ink-950"
                          checked={levelSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = levelPartial;
                          }}
                          onChange={(e) => toggleGroup(levelGroup.items, e.target.checked)}
                        />
                        <span className="text-sm font-medium text-ink-700/80">
                          {levelGroup.levelName}
                        </span>
                      </div>

                      <div className="flex flex-col gap-4">
                        {levelGroup.items.map((req) => (
                          <div key={req.id} className="rounded-sm border border-ink-700/15 p-5 bg-white">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  className="mt-1 h-4 w-4 accent-ink-950"
                                  checked={selectedIds.has(req.id)}
                                  onChange={(e) => toggleOne(req.id, e.target.checked)}
                               />
                                <div>
                                  <p className="font-mono text-xs text-ink-700">
                                    {req.departments?.name}
                                  </p>
                                  <p className="mt-1 font-display text-lg">
                                    {req.code} — {req.title}
                                  </p>
                                  <p className="mt-1 text-sm text-ink-700">
                                    Requested by {requesterNames[req.requested_by] ?? 'a student'} ·{' '}
                                    {new Date(req.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="flex shrink-0 gap-2">
                                <button
                                  onClick={() => handleApprove(req.id)}
                                  disabled={busyId === req.id || bulkBusy}
                                  className="rounded-sm bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => setRejectingId(rejectingId === req.id ? null : req.id)}
                                  disabled={bulkBusy}
                                  className="rounded-sm border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
                                >
                                  Reject
                                </button>
                              </div>
                            </div>

                            {rejectingId === req.id && (
                              <div className="mt-4 flex gap-2 border-t border-ink-700/10 pt-4">
                                <input
                                  type="text"
                                  placeholder="Reason for rejection (required)"
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                  className="flex-1 rounded-sm border border-ink-700/20 px-3 py-2 text-sm"
                                />
                                <button
                                  onClick={() => handleReject(req.id)}
                                  disabled={busyId === req.id}
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
        })}
      </div>
    </div>
  );
}