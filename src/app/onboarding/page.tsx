import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import OnboardingForm from './OnboardingForm';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  // Checked server-side, before any HTML renders — this is what removes the
  // "briefly looks signed out, redirects anyway" race condition that a
  // client-side-only check was prone to.
  if (!userData?.user) {
    redirect('/sign-in');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', userData.user.id)
    .single();

  if (profile?.onboarding_completed) {
    redirect('/');
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-6 py-16">
      <OnboardingForm userId={userData.user.id} />
    </main>
  );
}
