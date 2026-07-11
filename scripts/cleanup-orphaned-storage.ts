/**
 * scripts/cleanup-orphaned-storage.ts
 *
 * One-off maintenance script — NOT part of the app, not a cron job. Run this
 * once, locally, to catch storage bytes left behind by the old delete
 * behavior (soft-delete only, no storage removal) from before that was
 * fixed. Safe to re-run: it only acts on rows it finds and skips files that
 * are already gone.
 *
 * What it does:
 * 1. Every upload with status='deleted' that still has a storage_path —
 * these were soft-deleted under the old code, so their bytes were
 * never actually removed.
 * 2. Every upload attached to an archived course that ISN'T already
 * status='deleted' — these predate the course-delete cascade, so
 * neither their DB status nor their storage bytes were ever touched.
 * For each one: check if the file still exists in the bucket, remove it
 * if so, and make sure the DB row says status='deleted' afterward so this
 * stays consistent going forward.
 *
 * Setup:
 * npm install -D tsx dotenv   (if you don't already have them)
 * npm install ws              (needed for Node 20 environment compatibility)
 * Make sure SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL are in
 * your .env.local (or export them in your shell before running).
 *
 * Run:
 * npx tsx --env-file=.env.local scripts/cleanup-orphaned-storage.ts
 *
 * This uses the service role key, which bypasses RLS entirely — never
 * commit it, never run this against a URL you don't recognize, and delete
 * or stop using this script once you've confirmed your storage is clean.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.');
  process.exit(1);
}

// Fixed type compilation error by declaring ws "as any" to fulfill the internal Realtime requirements
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
  },
  realtime: {
    transport: ws as any,
  },
});

type UploadRow = {
  id: string;
  storage_path: string | null;
  storage_bucket: string | null;
  generated_filename: string;
  status: string;
};

async function fileExists(bucket: string, path: string): Promise<boolean> {
  const dir = path.split('/').slice(0, -1).join('/');
  const filename = path.split('/').pop()!;
  const { data } = await supabase.storage.from(bucket).list(dir, { search: filename });
  return (data ?? []).some((f) => f.name === filename);
}

async function main() {
  console.log('Scanning for orphaned storage...\n');

  // Case 1: soft-deleted uploads from before the fix.
  const { data: deletedUploads, error: deletedError } = await supabase
    .from('uploads')
    .select('id, storage_path, storage_bucket, generated_filename, status')
    .eq('status', 'deleted')
    .not('storage_path', 'is', null);

  if (deletedError) throw deletedError;

  // Case 2: uploads under archived courses from before the cascade existed.
  const { data: archivedCourses, error: archivedError } = await supabase
    .from('courses')
    .select('id')
    .eq('status', 'archived');

  if (archivedError) throw archivedError;

  const archivedCourseIds = (archivedCourses ?? []).map((c) => c.id);
  let uploadsUnderArchivedCourses: UploadRow[] = [];

  if (archivedCourseIds.length > 0) {
    const { data, error } = await supabase
      .from('uploads')
      .select('id, storage_path, storage_bucket, generated_filename, status')
      .in('course_id', archivedCourseIds)
      .not('storage_path', 'is', null)
      .neq('status', 'deleted');

    if (error) throw error;
    uploadsUnderArchivedCourses = (data as UploadRow[]) ?? [];
  }

  const candidates = [...((deletedUploads as UploadRow[]) ?? []), ...uploadsUnderArchivedCourses];
  console.log(`Found ${candidates.length} upload row(s) to check.\n`);

  let removedCount = 0;
  let alreadyGoneCount = 0;
  let failedCount = 0;

  for (const upload of candidates) {
    if (!upload.storage_path || !upload.storage_bucket) continue;

    const exists = await fileExists(upload.storage_bucket, upload.storage_path);

    if (!exists) {
      console.log(`  already gone:  ${upload.generated_filename}`);
      alreadyGoneCount++;
    } else {
      const { error: removeError } = await supabase.storage
        .from(upload.storage_bucket)
        .remove([upload.storage_path]);

      if (removeError) {
        console.error(`  FAILED:        ${upload.generated_filename} — ${removeError.message}`);
        failedCount++;
        continue;
      }

      console.log(`  removed:       ${upload.generated_filename} (${upload.storage_bucket}/${upload.storage_path})`);
      removedCount++;
    }

    if (upload.status !== 'deleted') {
      await supabase
        .from('uploads')
        .update({ status: 'deleted', deleted_at: new Date().toISOString() })
        .eq('id', upload.id);
    }
  }

  console.log('\nDone.');
  console.log(`  Removed from storage: ${removedCount}`);
  console.log(`  Already gone:         ${alreadyGoneCount}`);
  console.log(`  Failed:               ${failedCount}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});