'use client';

import { useEffect, useState } from 'react';
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

  return (
    <div className="text-ink-950">
      {!hideHeader && (
        <>
          <BackLink fallbackHref="/" label="Back" />
          <h1 className="mt-4 font-display text-2xl font-semibold">Course requests</h1>
        </>
      )}
      <p className={hideHeader ? 'text-sm text-ink-700' : 'mt-2 text-sm text-ink-700'}>
        Showing pending course folder requests — {requests.length} waiting.
      </p>

      {message && <p className="mt-4 text-sm text-red-600">{message}</p>}

      {requests.length === 0 && (
        <p className="mt-10 text-ink-700/60">Nothing pending right now.</p>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {requests.map((req) => (
          <div key={req.id} className="rounded-sm border border-ink-700/15 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-ink-700">
                  {req.departments?.name} · {req.levels?.name} · {displaySemester(req.semester)} Semester
                </p>
                <p className="mt-1 font-display text-lg">
                  {req.code} — {req.title}
                </p>
                <p className="mt-1 text-sm text-ink-700">
                  Requested by {requesterNames[req.requested_by] ?? 'a student'} ·{' '}
                  {new Date(req.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => handleApprove(req.id)}
                  disabled={busyId === req.id}
                  className="rounded-sm bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  onClick={() => setRejectingId(rejectingId === req.id ? null : req.id)}
                  className="rounded-sm border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
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
}
