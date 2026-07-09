'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { BackLink } from '@/components/nav/BackLink';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const supabase = createClient();

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: displayName } },
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data.session) {
      window.location.href = '/onboarding';
      return;
    }

    setSubmitted(true);
  }

  async function handleGoogleSignUp() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  if (submitted) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-950">Check your email</h1>
        <p className="mt-2 text-sm text-ink-700">
          We've sent a confirmation link to {email}. Click it, then come back and sign in.
        </p>
        <p className="mt-4 text-xs text-ink-700/70">
          Nothing arriving? Supabase's built-in email sender is rate-limited for
          testing — ask whoever set up the project to either turn off "Confirm
          email" in Supabase, or check spam.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <BackLink fallbackHref="/" label="Back" />
      <h1 className="mt-4 font-display text-2xl font-semibold text-ink-950">Create an account</h1>
      <p className="mt-2 text-sm text-ink-700">
        Use your Covenant University email address (@stu.cu.edu.ng, @cu.edu.ng,
        or @covenantuniversity.edu.ng) — any other domain will be rejected.
      </p>

      <form onSubmit={handleSignUp} className="mt-6 flex flex-col gap-3">
        <input
          type="text"
          required
          placeholder="Full name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="rounded-sm border border-ink-700/20 px-4 py-3 text-sm"
        />
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
          minLength={8}
          placeholder="Password (min. 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-sm border border-ink-700/20 px-4 py-3 text-sm"
        />
        <button
          type="submit"
          className="rounded-sm bg-ink-950 px-4 py-3 text-sm font-medium text-paper-50 hover:bg-ink-900"
        >
          Create account
        </button>
      </form>

      <div className="my-4 text-center text-xs text-ink-700/60">or</div>

      <button
        onClick={handleGoogleSignUp}
        className="rounded-sm border border-ink-700/20 px-4 py-3 text-sm font-medium hover:border-ink-700/40"
      >
        Continue with Google
      </button>

      {message && <p className="mt-4 text-sm text-red-600">{message}</p>}

      <p className="mt-6 text-center text-sm text-ink-700">
        Already have an account?{' '}
        <Link href="/sign-in" className="font-medium text-ink-950 underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
