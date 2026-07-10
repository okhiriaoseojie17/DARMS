import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProfileForm from './ProfileForm';
import PasswordForm from './PasswordForm';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    redirect('/sign-in');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, email')
    .eq('id', userData.user.id)
    .single();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-2xl font-semibold text-ink-950">Your profile</h1>
      <p className="mt-1 text-sm text-ink-700">
        Update your name, department, and level, or set a password so you can
        sign in without Google.
      </p>

      <section className="mt-8">
        <ProfileForm
          userId={userData.user.id}
          initialDisplayName={profile?.display_name ?? ''}
          email={profile?.email ?? userData.user.email ?? ''}
        />
      </section>

      <section className="mt-10 border-t border-ink-700/10 pt-8">
        <PasswordForm />
      </section>
    </div>
  );
}
