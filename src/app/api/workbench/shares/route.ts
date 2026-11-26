import { failure, jsonResponse, readInput, sameOrigin } from '../http.ts';
import { AskError } from '../ask/contract.ts';
import { createShare, listShares, shareAccount, shareByteLimit } from './store.ts';

export async function GET(request: Request) {
  try {
    const owner = await shareAccount();
    const offset = Number(new URL(request.url).searchParams.get('offset') || 0);
    if (!Number.isSafeInteger(offset) || offset < 0) throw new AskError(400, '无效的共享列表位置。');
    return jsonResponse(await listShares(owner, offset));
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const owner = await shareAccount();
    return jsonResponse({ share: await createShare(owner, await readInput(request, shareByteLimit)) }, 201);
  } catch (error) { return failure(error); }
}
