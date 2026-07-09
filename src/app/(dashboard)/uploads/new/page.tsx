import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import UploadForm from './UploadForm';

export default async function NewUploadPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    redirect('/sign-in?next=/uploads/new');
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-6 py-16">
      <UploadForm />
    </main>
  );
}
