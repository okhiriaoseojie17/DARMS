import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * The service role key bypasses RLS completely — that's necessary here
 * because a cron job has no signed-in user and needs to see rejected/deleted
 * uploads across every department, not just what one person's session could
 * see. This is the ONLY file in the codebase that should ever import
 * SUPABASE_SERVICE_ROLE_KEY. Never call this from a route that a browser
 * request can trigger without the CRON_SECRET check — see
 * /api/cron/retention-purge for the pattern to follow.
 */
export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
