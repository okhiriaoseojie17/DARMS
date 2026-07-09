'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BackLink } from '@/components/nav/BackLink';

export default function SignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createClient();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/onboarding';

  // Surfaces errors redirected here from /auth/callback (e.g. a non-CU
  // Google account being rejected by the domain-check trigger).
  useEffect(() => {
    const error = searchParams.get('error');
    if (error) setMessage(error);
  }, [searchParams]);

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    else window.location.href = next;
  }

  async function handleGoogleSignIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
  }

  return (
    <>
      <BackLink fallbackHref="/" label="Back" />
      <h1 className="mt-4 font-display text-2xl font-semibold text-ink-950">Sign in</h1>
      <p className="mt-2 text-sm text-ink-700">
        Use your Covenant University email address (@stu.cu.edu.ng, @cu.edu.ng,
        or @covenantuniversity.edu.ng).
      </p>

      <form onSubmit={handleEmailSignIn} className="mt-6 flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="you@stu.cu.edu.ng"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-sm border border-ink-700/20 px-4 py-3 text-sm"
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-sm border border-ink-700/20 px-4 py-3 text-sm"
        />
        <button
          type="submit"
          className="rounded-sm bg-ink-950 px-4 py-3 text-sm font-medium text-paper-50 hover:bg-ink-900"
        >
          Sign in
        </button>
      </form>

      <div className="my-4 text-center text-xs text-ink-700/60">or</div>

      <button
        onClick={handleGoogleSignIn}
        className="w-full rounded-sm border border-ink-700/20 px-4 py-3 text-sm font-medium hover:border-ink-700/40"
      >
        Continue with Google
      </button>

      {message && <p className="mt-4 text-sm text-red-600">{message}</p>}

      <p className="mt-6 text-center text-sm text-ink-700">
        Don't have an account?{' '}
        <Link href="/sign-up" className="font-medium text-ink-950 underline">
          Sign up
        </Link>
      </p>
    </>
  );
}
