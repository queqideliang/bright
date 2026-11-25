import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ModelLibrary } from './model-library';
import './models.css';

export const metadata = { title: '我的模型库 · BRIGHT VISION' };

export default async function ModelsPage() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/login?next=/models');
  return <ModelLibrary />;
}
