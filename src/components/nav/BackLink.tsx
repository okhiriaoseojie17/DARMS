'use client';

import { useRouter } from 'next/navigation';

export function BackLink({ fallbackHref = '/', label = 'Back' }: { fallbackHref?: string; label?: string }) {
  const router = useRouter();

  function handleClick() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      onClick={handleClick}
      className="text-sm text-ink-700/60 hover:text-amber-600"
      type="button"
    >
      &larr; {label}
    </button>
  );
}
