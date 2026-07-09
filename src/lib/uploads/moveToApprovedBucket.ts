import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Moves a file from `uploads-pending` to `uploads-approved` and updates the
 * upload row's storage_bucket accordingly. Used in two places:
 *  1. /api/uploads/[id]/approve — a reviewer manually approving a pending upload
 *  2. /api/uploads (POST) — when the DB trigger auto-approves an upload for a
 *     Lecturer/Level Advisor with scoped auto_approve rights, since that
 *     trigger only flips `status`, it can't reach out to Storage itself
 *
 * Supabase Storage has no cross-bucket move, so this is a plain
 * download -> upload -> delete. No-ops safely for link-type uploads (no
 * storage_path) so callers can call it unconditionally after any approval.
 */
export async function moveUploadToApprovedBucket(
  supabase: SupabaseClient,
  upload: { id: string; storage_path: string | null; file_type: string }
): Promise<{ success: boolean; error?: string }> {
  if (upload.file_type === 'link' || !upload.storage_path) {
    // Nothing to move — still mark the bucket field null/consistent.
    await supabase.from('uploads').update({ storage_bucket: null }).eq('id', upload.id);
    return { success: true };
  }

  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from('uploads-pending')
    .download(upload.storage_path);

  if (downloadError || !fileBlob) {
    return { success: false, error: downloadError?.message ?? 'Could not read the pending file' };
  }

  const { error: uploadError } = await supabase.storage
    .from('uploads-approved')
    .upload(upload.storage_path, fileBlob, { upsert: true });

  if (uploadError) {
    return { success: false, error: uploadError.message };
  }

  await supabase.storage.from('uploads-pending').remove([upload.storage_path]);

  await supabase.from('uploads').update({ storage_bucket: 'uploads-approved' }).eq('id', upload.id);

  return { success: true };
}
