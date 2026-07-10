'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BackLink } from '@/components/nav/BackLink';
import UploadForm from './UploadForm';
import CourseRequestForm from '../../courses/new/CourseRequestForm';

type Tab = 'upload' | 'request';

export default function UploadOrRequest() {
  const searchParams = useSearchParams();
  const initialTab: Tab = searchParams.get('tab') === 'request' ? 'request' : 'upload';
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="text-ink-950">
      <BackLink fallbackHref="/" label="Back" />

      <div className="mt-4 flex gap-1 rounded-sm border border-ink-700/15 p-1">
        <button
          type="button"
          onClick={() => setTab('upload')}
          className={`flex-1 rounded-sm px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'upload' ? 'bg-ink-950 text-paper-50' : 'text-ink-700 hover:bg-ink-700/5'
          }`}
        >
          Upload a resource
        </button>
        <button
          type="button"
          onClick={() => setTab('request')}
          className={`flex-1 rounded-sm px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'request' ? 'bg-ink-950 text-paper-50' : 'text-ink-700 hover:bg-ink-700/5'
          }`}
        >
          Request a course
        </button>
      </div>

      <div className="mt-8">
        {tab === 'upload' ? (
          <UploadForm hideHeader onRequestCourse={() => setTab('request')} />
        ) : (
          <CourseRequestForm hideHeader onBackToUpload={() => setTab('upload')} />
        )}
      </div>
    </div>
  );
}
