'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/creator/about', label: 'About Me' },
  { href: '/creator/legal', label: 'Legal & Copyright' },
] as const;

export function CreatorTabNav() {
  const pathname = usePathname();

  return (
    <div className="flex gap-6 border-b border-paper-200">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
              active
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-ink-700/60 hover:text-ink-950'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
