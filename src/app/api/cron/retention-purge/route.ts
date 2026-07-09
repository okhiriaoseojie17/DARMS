import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/serviceRole';

const RETENTION_DAYS = 30;

/**
 * GET /api/cron/retention-purge
 *
 * Called on a schedule by Vercel Cron (see vercel.json) — never by a person
 * or the frontend. Protected by comparing the Authorization header against
 * CRON_SECRET, which Vercel automatically attaches when it invokes a
 * configured cron route. Anyone else calling this without that header gets
 * a 401, since this uses the service-role client and must not be reachable
 * by an arbitrary signed-in user.
 *
 * What it does: for uploads that were rejected, or (once the archive/delete
 * UI exists) explicitly deleted, more than RETENTION_DAYS ago, permanently
 * removes the underlying file from Storage and clears storage_path — the
 * database row itself is kept for audit history (approval_events already
 * has the full trail), only the file bytes are purged.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const results = { rejected: 0, deleted: 0, errors: [] as string[] };

  // Rejected uploads past the retention window
  const { data: rejectedUploads } = await supabase
    .from('uploads')
    .select('id, storage_path, storage_bucket')
    .eq('status', 'rejected')
    .lt('reviewed_at', cutoff)
    .is('purged_at', null)
    .not('storage_path', 'is', null);

  for (const upload of rejectedUploads ?? []) {
    const bucket = upload.storage_bucket ?? 'uploads-pending';
    const { error } = await supabase.storage.from(bucket).remove([upload.storage_path!]);
    if (error) {
      results.errors.push(`rejected ${upload.id}: ${error.message}`);
      continue;
    }
    await supabase
      .from('uploads')
      .update({ storage_path: null, purged_at: new Date().toISOString() })
      .eq('id', upload.id);
    results.rejected += 1;
  }

  // Explicitly deleted uploads past the retention window (archive -> delete
  // flow — no UI for this yet, but the purge logic is ready for when it
  // exists, per §16 of the architecture doc)
  const { data: deletedUploads } = await supabase
    .from('uploads')
    .select('id, storage_path, storage_bucket')
    .eq('status', 'deleted')
    .lt('deleted_at', cutoff)
    .is('purged_at', null)
    .not('storage_path', 'is', null);

  for (const upload of deletedUploads ?? []) {
    const bucket = upload.storage_bucket ?? 'uploads-approved';
    const { error } = await supabase.storage.from(bucket).remove([upload.storage_path!]);
    if (error) {
      results.errors.push(`deleted ${upload.id}: ${error.message}`);
      continue;
    }
    await supabase
      .from('uploads')
      .update({ storage_path: null, purged_at: new Date().toISOString() })
      .eq('id', upload.id);
    results.deleted += 1;
  }

  return NextResponse.json({ success: true, ...results });
}
