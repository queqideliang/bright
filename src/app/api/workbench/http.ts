import { AskError } from './ask/contract.ts';

export function jsonResponse(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
}

export function failure(error: unknown) {
  return error instanceof AskError ? jsonResponse({ error: error.message }, error.status) : jsonResponse({ error: '暂时无法处理本次请求。' }, 500);
}

export { requireWorkbenchOrigin as sameOrigin } from './ask/access.ts';

export async function readInput(request: Request, limit: number): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new AskError(415, '请求需要使用 JSON 格式。');
  }
  if (Number(request.headers.get('content-length')) > limit) throw new AskError(413, '发送的资料过大，请缩小范围。');
  if (!request.body) throw new AskError(400, '缺少请求内容。');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0, body = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new AskError(413, '发送的资料过大，请缩小范围。');
      }
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } catch (error) {
    if (error instanceof AskError) throw error;
    throw new AskError(400, '请求需要 UTF-8 JSON 数据。');
  } finally { reader.releaseLock(); }
}
