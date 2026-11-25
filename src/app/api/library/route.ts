import { accountStorage, beginUpload, libraryFailure, libraryResponse, listLibrary } from '@/lib/model-library/storage';

export async function GET(request: Request) {
  try {
    const store = await accountStorage();
    const offset = Number(new URL(request.url).searchParams.get('offset') ?? 0);
    if (!Number.isSafeInteger(offset) || offset < 0) return libraryResponse({ error: '无效的模型列表位置。' }, 400);
    return libraryResponse(await listLibrary(store, offset));
  } catch (error) { return libraryFailure(error); }
}

export async function POST(request: Request) {
  try {
    const store = await accountStorage();
    return libraryResponse(await beginUpload(store, await request.json().catch(() => null)));
  } catch (error) { return libraryFailure(error); }
}
