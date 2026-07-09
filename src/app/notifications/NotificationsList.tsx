'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { BackLink } from '@/components/nav/BackLink';

type Notification = {
  id: string;
  type: string;
  payload: {
    uploadId?: string;
    filename?: string;
    courseId?: string;
    reason?: string;
    requestId?: string;
    code?: string;
    title?: string;
    departmentId?: string;
  };
  read_at: string | null;
  created_at: string;
};

// In NotificationsList.tsx
const TYPE_LABEL: Record<string, string> = {
  upload_approved: 'Approved',
  upload_rejected: 'Rejected',
  course_approved: 'Course approved',
  course_rejected: 'Course rejected',
  course_request_submitted: 'New course request',
  upload_submitted: 'New upload pending',
};

export default function NotificationsList({ userId }: { userId: string }) {
  const supabase = createClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('profile_id', userId)
        .order('created_at', { ascending: false });
      setNotifications((data as any) ?? []);
      setLoading(false);
    }
    load();
  }, [userId, supabase]);

  async function markAllRead() {
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n))
    );
  }

  if (loading) {
    return <p className="text-sm text-ink-700">Loading…</p>;
  }

  return (
    <div className="text-ink-950">
      <BackLink fallbackHref="/" label="Back" />
      <div className="mt-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Notifications</h1>
        {notifications.some((n) => !n.read_at) && (
          <button onClick={markAllRead} className="text-sm text-ink-700 underline hover:text-amber-600">
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 && (
        <p className="mt-10 text-ink-700/60">Nothing yet — you'll see upload decisions here.</p>
      )}

      <div className="mt-6 flex flex-col gap-2">
        {notifications.map((n) => (
          <button
            key={n.id}
            onClick={() => markRead(n.id)}
            className={`flex flex-col gap-1 rounded-sm border px-4 py-3 text-left text-sm transition-colors ${
              n.read_at ? 'border-ink-700/10 text-ink-700' : 'border-amber-500/50 bg-amber-500/5 text-ink-950'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`rounded-sm px-2 py-0.5 text-xs font-medium uppercase ${
                  n.type === 'upload_approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}
              >
                {TYPE_LABEL[n.type] ?? n.type}
              </span>
              <span className="text-xs text-ink-700/60">{new Date(n.created_at).toLocaleString()}</span>
            </div>
            <p>
             {n.type === 'course_request_submitted' && `${n.payload.code} — ${n.payload.title ?? 'New course request'}`}
             {n.type === 'upload_submitted' && (n.payload.filename ?? 'A new upload')}
             {(n.type === 'upload_approved' || n.type === 'upload_rejected') && (n.payload.filename ?? 'An upload')}
             {n.type === 'course_rejected' && n.payload.title}
             {n.type === 'course_approved' && n.payload.title}
             {n.type === 'upload_rejected' && n.payload.reason && (
    <span className="text-ink-700"> — {n.payload.reason}</span>
  )}
</p>
            {n.payload.courseId && (
              <Link
                href={`/courses/${n.payload.courseId}`}
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-amber-600 underline hover:text-amber-700"
              >
                View course
              </Link>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
