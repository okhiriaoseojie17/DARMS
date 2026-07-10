'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BackLink } from '@/components/nav/BackLink';
import ReviewQueue from './ReviewQueue';
import CourseRequestQueue from '../courses/CourseRequestQueue';

type Tab = 'review' | 'courses';

export default function AdminReviewTabs({ userId }: { userId: string }) {
  const searchParams = useSearchParams();
  const initialTab: Tab = searchParams.get('tab') === 'courses' ? 'courses' : 'review';
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="text-ink-950">
      <BackLink fallbackHref="/" label="Back" />

      <div className="mt-4 flex gap-1 rounded-sm border border-ink-700/15 p-1">
        <button
          type="button"
          onClick={() => setTab('review')}
          className={`flex-1 rounded-sm px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'review' ? 'bg-ink-950 text-paper-50' : 'text-ink-700 hover:bg-ink-700/5'
          }`}
        >
          Review queue
        </button>
        <button
          type="button"
          onClick={() => setTab('courses')}
          className={`flex-1 rounded-sm px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'courses' ? 'bg-ink-950 text-paper-50' : 'text-ink-700 hover:bg-ink-700/5'
          }`}
        >
          Course requests
        </button>
      </div>

      <div className="mt-8">
        {tab === 'review' ? (
          <ReviewQueue userId={userId} hideHeader />
        ) : (
          <CourseRequestQueue userId={userId} hideHeader />
        )}
      </div>
    </div>
  );
}
