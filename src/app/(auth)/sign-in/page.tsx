import { Suspense } from 'react';
import SignInForm from './SignInForm';

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Suspense fallback={<p className="text-sm text-ink-700">Loading…</p>}>
        <SignInForm />
      </Suspense>
    </main>
  );
}
