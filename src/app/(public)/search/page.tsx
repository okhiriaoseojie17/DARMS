'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/courses?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setResults(data.courses ?? []);
    setSearched(true);
  }

  return (
    <main className="min-h-screen bg-ink-950 px-6 py-16 text-paper-50">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-paper-200/60 hover:text-amber-500">
          &larr; Back
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold">Search courses</h1>

        <form onSubmit={handleSearch} className="mt-6 flex gap-2">
          <input
            type="text"
            placeholder="Course title, e.g. Data Structures"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 rounded-sm border border-paper-200/20 bg-transparent px-4 py-3 text-sm text-paper-50 placeholder:text-paper-200/40"
          />
          <button
            type="submit"
            className="rounded-sm bg-amber-500 px-5 py-3 text-sm font-medium text-ink-950 hover:bg-amber-600"
          >
            Search
          </button>
        </form>

        <div className="mt-8 flex flex-col gap-3">
          {searched && results.length === 0 && (
            <p className="text-paper-200/60">No approved courses matched that search.</p>
          )}
          {results.map((course) => (
            <Link
              key={course.id}
              href={`/courses/${course.id}`}
              className="rounded-sm border border-paper-200/15 p-4 transition-colors hover:border-amber-500/60"
            >
              <p className="font-mono text-xs text-paper-200/60">{course.code}</p>
              <p className="mt-1 font-display text-base">{course.title}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
