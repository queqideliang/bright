import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ModelLibrary } from './model-library';
import ProductHeader from '@/components/product-header';
import './models.css';

export const metadata = { title: '我的模型库 · BRIGHT VISION' };

export default async function ModelsPage({ searchParams }: { searchParams: Promise<{ tool?: string | string[] }> }) {
  const reviewing = (await searchParams).tool === 'review';
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/login?next=' + encodeURIComponent(reviewing ? '/models?tool=review' : '/models'));
  return <><ProductHeader active={reviewing ? 'review' : 'models'} /><ModelLibrary reviewing={reviewing} /></>;
}
