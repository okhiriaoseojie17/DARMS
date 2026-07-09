import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// This MUST live at exactly /auth/callback (a real folder, not a route group)
// because that's the literal URL Google redirects back to, and it must match
// what's registered in the Supabase dashboard under Authentication -> URL
// Configuration -> Redirect URLs.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/onboarding';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    // Most common cause here: the domain-check trigger (migration 0002)
    // rejected sign-up because the Google account's email isn't on an
    // allowed CU domain.
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(`${origin}/sign-in?error=No authorization code returned`);
}
