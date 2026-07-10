'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type InitialUser = { id: string; displayName: string } | null;

export function AuthNav({ initialUser }: { initialUser: InitialUser }) {
  // Fixes Bug 3: Instantly renders the server-provided identity to avoid navigation flashes
  const [displayName, setDisplayName] = useState<string | null>(
    initialUser ? initialUser.displayName : null
  );
  const [signedIn, setSignedIn] = useState(initialUser !== null);
  const [unreadCount, setUnreadCount] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    async function loadProfile() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        setSignedIn(false);
        setDisplayName(null);
        return;
      }
      setSignedIn(true);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', userData.user.id)
        .single();
      setDisplayName(profile?.display_name ?? userData.user.email ?? 'Account');

      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', userData.user.id)
        .is('read_at', null);
      setUnreadCount(count ?? 0);
    }
    loadProfile();

    const { data: listener } = supabase.auth.onAuthStateChange(() => loadProfile());
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  if (!signedIn) {
    return (
      <Link href="/sign-in" className="hover:text-amber-500">
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-5">
      <Link href="/uploads/new" className="text-sm hover:text-amber-500">
        Upload
      </Link>
      <Link href="/courses/new" className="text-sm hover:text-amber-500">
        Request course
      </Link>
      <Link href="/admin/review" className="text-sm hover:text-amber-500">
        Review queue
      </Link>
      <Link href="/admin/courses" className="text-sm hover:text-amber-500">
     Course requests
      </Link>
      <Link href="/notifications" className="relative text-sm hover:text-amber-500">
        Notifications
        {unreadCount > 0 && (
          <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-ink-950">
            {unreadCount}
          </span>
        )}
      </Link>
      <Link href="/profile" className="text-sm text-paper-200/80 hover:text-amber-500">
        {displayName}
      </Link>
      <button onClick={handleSignOut} className="text-sm hover:text-amber-500">
        Sign out
      </button>
    </div>
  );
}