import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { storageForAccount, findLibraryItem } from '@/lib/model-library/storage';
import { libraryIdPattern, modelKind } from '@/lib/model-library/formats';
import { createClient } from '@/lib/supabase/server';
import { GeometryView } from './geometry-view';
import '../models.css';

export const metadata = { title: '查看云端模型 · BRIGHT VISION' };

export default async function StoredModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!libraryIdPattern.test(id)) notFound();
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/login?next=/models/' + id);
  const model = await findLibraryItem(storageForAccount(user.id), id);
  if (!model) notFound();
  return <main className="bv-library bv-model">
    <header className="bv-bar"><Link href="/models">我的模型库</Link><strong>{model.name}</strong></header>
    {modelKind(model.name) === 'geometry' ? <GeometryView id={id} /> :
      <iframe className="bv-frame" title="云端 BIM 模型" src={'/bim-viewer/index.html#modelId=' + id} allow="fullscreen" />}
  </main>;
}
