import { createBrowserClient } from '@supabase/ssr';

// Used only inside Client Components ('use client'). Server Components and
// API routes must use server.ts instead — never mix the two.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
