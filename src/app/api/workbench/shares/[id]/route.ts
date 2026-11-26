import { failure, jsonResponse, sameOrigin } from '../../http.ts';
import { readShare, revokeShare, shareAccount } from '../store.ts';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    return jsonResponse({ share: await readShare(await shareAccount(), (await params).id) });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    sameOrigin(request);
    await revokeShare(await shareAccount(), (await params).id);
    return jsonResponse({ revoked: true });
  } catch (error) { return failure(error); }
}
