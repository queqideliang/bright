import { accountStorage, findLibraryItem, libraryFailure, libraryGrant, libraryResponse } from '@/lib/model-library/storage';
import { modelKind } from '@/lib/model-library/formats';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  try {
    const store = await accountStorage();
    const { id, action } = await params;
    const item = await findLibraryItem(store, id);
    if (!item || !['viewer', 'content'].includes(action)) return libraryResponse({ error: '模型不存在，或当前账号没有查看权限。' }, 404);
    if (action === 'content') return libraryResponse(await libraryGrant(store, item));
    return libraryResponse({ kind: modelKind(item.name), fileName: item.name, size: item.size,
      sha256: item.sha256, downloadUrl: '/api/library/' + id + '/content' });
  } catch (error) { return libraryFailure(error); }
}
