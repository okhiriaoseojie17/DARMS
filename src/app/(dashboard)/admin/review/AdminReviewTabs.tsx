'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BackLink } from '@/components/nav/BackLink';
import ReviewQueue from './ReviewQueue';
import CourseRequestQueue from '../courses/CourseRequestQueue';
import ManageUploads from './ManageUploads';
import ManageCourses from './ManageCourses';

type Tab = 'review' | 'courses' | 'manage-uploads' | 'manage-courses';

const TAB_PARAM_MAP: Record<string, Tab> = {
  courses: 'courses',
  manage: 'manage-uploads',
  'manage-uploads': 'manage-uploads',
  'manage-courses': 'manage-courses',
};

export default function AdminReviewTabs({ userId }: { userId: string }) {
  const searchParams = useSearchParams();
  const initialTabParam = searchParams.get('tab');
  const initialTab: Tab = (initialTabParam && TAB_PARAM_MAP[initialTabParam]) || 'review';
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="text-ink-950">
      <BackLink fallbackHref="/" label="Back" />

      <div className="mt-4 flex flex-wrap gap-1 rounded-sm border border-ink-700/15 p-1">
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
        <button
          type="button"
          onClick={() => setTab('manage-uploads')}
          className={`flex-1 rounded-sm px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'manage-uploads' ? 'bg-ink-950 text-paper-50' : 'text-ink-700 hover:bg-ink-700/5'
          }`}
        >
          Manage uploads
        </button>
        <button
          type="button"
          onClick={() => setTab('manage-courses')}
          className={`flex-1 rounded-sm px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'manage-courses' ? 'bg-ink-950 text-paper-50' : 'text-ink-700 hover:bg-ink-700/5'
          }`}
        >
          Manage courses
        </button>
      </div>

      <div className="mt-8">
        {tab === 'review' && <ReviewQueue userId={userId} hideHeader />}
        {tab === 'courses' && <CourseRequestQueue userId={userId} hideHeader />}
        {tab === 'manage-uploads' && <ManageUploads userId={userId} />}
        {tab === 'manage-courses' && <ManageCourses userId={userId} />}
      </div>
    </div>
  );
}
