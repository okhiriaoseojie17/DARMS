import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AuthNav } from './AuthNav';

// Rendered once from the root layout so every route — public, auth, and
// dashboard pages alike — gets the same logo + nav without each page.tsx
// having to build its own header.
export async function SiteHeader() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  let initialUser: { id: string; displayName: string } | null = null;

  if (userData?.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userData.user.id)
      .single();

    initialUser = {
      id: userData.user.id,
      displayName: profile?.display_name ?? userData.user.email ?? 'Account',
    };
  }

  return (
    <header className="border-b border-paper-200/10 bg-ink-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="DARMS — Department Academic Resource Management System"
            width={140}
            height={76}
            priority
            className="h-8 w-auto md:h-9"
          />
        </Link>

        <nav className="flex items-center gap-6 text-sm text-paper-50">
          <Link href="/search" className="hover:text-amber-500">
            Search
          </Link>
          <AuthNav initialUser={initialUser} />
        </nav>
      </div>
    </header>
  );
}
