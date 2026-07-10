'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function PasswordForm() {
  const supabase = createClient();
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function checkIdentities() {
      const { data } = await supabase.auth.getUser();
      const identities = data.user?.identities ?? [];
      setHasPassword(identities.some((i) => i.provider === 'email'));
    }
    checkIdentities();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSuccess(false);

    if (password.length < 8) {
      setMessage('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    // This works for any signed-in user, regardless of how they originally
    // signed up — it sets the password on their existing auth.users row, so
    // afterward they can sign in with Google OR email + this password.
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setSuccess(true);
    setHasPassword(true);
    setPassword('');
    setConfirmPassword('');
  }

  return (
    <div className="text-ink-950">
      <h2 className="font-display text-base font-semibold">
        {hasPassword ? 'Change your password' : 'Set a password'}
      </h2>
      <p className="mt-1 text-sm text-ink-700">
        {hasPassword
          ? 'Update the password you use to sign in without Google.'
          : "You signed up with Google. Set a password so you can also sign in from a device without your Google account."}
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex max-w-sm flex-col gap-4">
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-sm border border-ink-700/20 px-4 py-3 text-sm"
        />
        <input
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="rounded-sm border border-ink-700/20 px-4 py-3 text-sm"
        />

        {message && <p className="text-sm text-red-600">{message}</p>}
        {success && (
          <p className="text-sm text-emerald-600">
            Password saved. You can now sign in with your email and this password too.
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !password || !confirmPassword}
          className="self-start rounded-sm bg-ink-950 px-4 py-3 text-sm font-medium text-paper-50 hover:bg-ink-900 disabled:opacity-40"
        >
          {submitting ? 'Saving…' : hasPassword ? 'Update password' : 'Set password'}
        </button>
      </form>
    </div>
  );
}
