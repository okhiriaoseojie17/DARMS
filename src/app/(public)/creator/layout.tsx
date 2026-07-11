import { BackLink } from '@/components/nav/BackLink';
import { CreatorTabNav } from './CreatorTabNav';

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl bg-paper-50 px-6 py-10">
      <BackLink fallbackHref="/" />

      <h1 className="mt-4 text-2xl font-semibold text-ink-950">Meet the Creator</h1>

      <div className="mt-6">
        <CreatorTabNav />
      </div>

      <div className="mt-10">{children}</div>
    </div>
  );
}
