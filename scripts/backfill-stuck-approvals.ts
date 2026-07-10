// One-time script: repairs uploads that were marked approved in the DB
// while the RLS bug was active, but whose file never actually moved to
// uploads-approved (storage_bucket still says 'uploads-pending').
//
// Run once with: npx tsx scripts/backfill-stuck-approvals.ts
// (or `node --loader ts-node/esm` depending on your setup)
//
// Requires SUPABASE_SERVICE_ROLE_KEY as an env var — this uses the service
// role specifically so it bypasses RLS entirely, since the whole point is
// to move files regardless of which admin originally approved them.

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    realtime: { transport: ws as any },
  }
);
async function moveUploadToApprovedBucket(upload: {
  id: string;
  storage_path: string | null;
  file_type: string;
}): Promise<{ success: boolean; error?: string }> {
  if (upload.file_type === 'link' || !upload.storage_path) {
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
    .upload(upload.storage_path, fileBlob, { upsert: false });

  if (uploadError) {
    return { success: false, error: uploadError.message };
  }

  await supabase.storage.from('uploads-pending').remove([upload.storage_path]);
  await supabase.from('uploads').update({ storage_bucket: 'uploads-approved' }).eq('id', upload.id);

  return { success: true };
}

async function main() {
  const { data: stuck, error } = await supabase
    .from('uploads')
    .select('id, storage_path, file_type, generated_filename')
    .eq('status', 'approved')
    .eq('storage_bucket', 'uploads-pending');

  if (error) {
    console.error('Failed to fetch stuck uploads:', error.message);
    process.exit(1);
  }

  if (!stuck || stuck.length === 0) {
    console.log('No stuck uploads found. Nothing to do.');
    return;
  }

  console.log(`Found ${stuck.length} stuck upload(s). Repairing...\n`);

  for (const upload of stuck) {
    process.stdout.write(`  ${upload.generated_filename} (${upload.id}) ... `);
    const result = await moveUploadToApprovedBucket(upload);
    console.log(result.success ? 'OK' : `FAILED: ${result.error}`);
  }

  console.log('\nDone.');
}

main();
