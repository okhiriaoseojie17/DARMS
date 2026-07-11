import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

// Design direction: a departmental archive, not a generic SaaS landing page.
// Dark ink-blue ground (a reading room at night) with paper-toned catalog
// cards laid on top — course codes get a stamped, monospace treatment since
// they function as real catalog identifiers here, not decoration.
// Logo + nav now live in the global SiteHeader (src/app/layout.tsx), so this
// page only renders the hero content below it.

export default async function HomePage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  // Fixes Bug 1: Redirects to upload form if logged in, otherwise to sign-in page
  const contributeHref = userData?.user ? '/uploads/new' : '/sign-in';

  return (
    <main className="min-h-screen bg-ink-950 text-paper-50">
      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 py-16 md:grid-cols-2 md:items-center">
        <div>
          <h1 className="font-display text-4xl font-semibold leading-tight text-paper-50 md:text-5xl">
            The department's shared archive of notes, tests, and past exams.
          </h1>
          <p className="mt-6 max-w-md text-paper-200/80">
            Every resource here has been reviewed by a lecturer or course
            administrator before it's added. Browse freely — an account is
            only needed if you want to contribute.
          </p>
          <div className="mt-8 flex gap-4">
            <Link
              href="/departments"
              className="rounded-sm bg-amber-500 px-5 py-3 text-sm font-medium text-ink-950 hover:bg-amber-600"
            >
              Browse by department
            </Link>
            <Link
              href={contributeHref}
              className="rounded-sm border border-paper-200/30 px-5 py-3 text-sm font-medium hover:border-paper-200/60"
            >
              Contribute a resource
            </Link>
          </div>
        </div>

        {/* Signature element: a catalog card, styled like a stamped index card */}
        <div className="relative mx-auto w-full max-w-sm rotate-1 rounded-sm bg-paper-100 p-6 text-ink-950 shadow-2xl">
          <div className="absolute -top-3 right-6 rounded-sm bg-amber-500 px-3 py-1 font-mono text-xs font-semibold text-ink-950">
            APPROVED
          </div>
          <p className="font-mono text-xs tracking-wide text-ink-700">CSC201 · 200 LEVEL · FIRST SEMESTER</p>
          <p className="mt-2 font-display text-xl font-semibold">Notes — Linked Lists</p>
          <div className="mt-4 border-t border-ink-950/10 pt-4 text-xs text-ink-700">
            <p>Uploaded by a 200L student · Reviewed by Course Administrator</p>
            <p className="mt-1">2024/2025 · First Semester</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl border-t border-paper-200/10 px-6 py-14">
        <h2 className="font-display text-2xl font-semibold">Departments</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { code: 'CS', name: 'Computer Science' },
            { code: 'MIS', name: 'Management Information Systems' },
            { code: 'SHARED', name: 'Shared Department' },
          ].map((dept) => (
            <Link
              key={dept.code}
              href={`/departments/${dept.code.toLowerCase()}`}
              className="rounded-sm border border-paper-200/15 p-5 transition-colors hover:border-amber-500/60"
            >
              <p className="font-mono text-xs text-amber-500">{dept.code}</p>
              <p className="mt-1 font-display text-lg">{dept.name}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}