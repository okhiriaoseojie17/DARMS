import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function DepartmentsPage() {
  const supabase = await createClient();
  const { data: departments } = await supabase.from('departments').select('*').order('name');

  return (
    <main className="min-h-screen bg-ink-950 px-6 py-16 text-paper-50">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm text-paper-200/60 hover:text-amber-500">
          &larr; Back
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold">Departments</h1>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {(departments ?? []).map((dept) => (
            <Link
              key={dept.id}
              href={`/departments/${dept.code.toLowerCase()}`}
              className="rounded-sm border border-paper-200/15 p-5 transition-colors hover:border-amber-500/60"
            >
              <p className="font-mono text-xs text-amber-500">{dept.code}</p>
              <p className="mt-1 font-display text-lg">{dept.name}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
