import { createClient } from '@/lib/supabase/server';
import { AskError, maxRequestBytes, parseCompletion, prepareTask } from './contract.ts';
import { completeTask } from './provider.ts';

const windowMs = 60_000;
const usage = new Map<string, { expires: number; calls: number }>();

// Per-account burst protection for this server instance. Entries stay ordered by expiration.
function checkRate(userId: string) {
  const now = Date.now();
  for (const [id, bucket] of usage) {
    if (bucket.expires > now) break;
    usage.delete(id);
  }
  const existing = usage.get(userId);
  if (existing) {
    if (existing.calls >= 20) throw new AskError(429, '提问过于频繁，请一分钟后再试。');
    existing.calls++;
  } else {
    usage.set(userId, { expires: now + windowMs, calls: 1 });
  }
}

async function readInput(request: Request): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > maxRequestBytes) throw new AskError(413, '发送的摘要过大，请缩小范围。');
  if (!request.body) throw new AskError(400, '请提供问题和资料。');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0;
  let body = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxRequestBytes) {
        await reader.cancel();
        throw new AskError(413, '发送的摘要过大，请缩小范围。');
      }
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } catch (error) {
    if (error instanceof AskError) throw error;
    throw new AskError(400, '请求需要 UTF-8 JSON 数据。');
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    const origin = request.headers.get('origin');
    const url = new URL(request.url);
    // Next may normalize the internal route URL to localhost behind a proxy.
    // Host still identifies the browser-facing authority, including its port.
    const host = request.headers.get('host');
    if (!origin || (origin !== url.origin && !(host && origin === url.protocol + '//' + host))) {
      throw new AskError(403, '请从本站工作台发起提问。');
    }
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      throw new AskError(415, '提问需要使用 JSON 格式。');
    }
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) throw new AskError(401, '请先登录，再使用 AI 问答。');
    const input: unknown = await readInput(request);
    if (input && typeof input === 'object' && 'owner' in input && input.owner !== user.id) {
      throw new AskError(403, '登录账号已变更，请重新选择当前账号的资料。');
    }
    const task = prepareTask(input);
    checkRate(user.id);
    const raw = await completeTask(task);
    return Response.json(parseCompletion(task, raw), { headers });
  } catch (error) {
    const known = error instanceof AskError;
    return Response.json({ error: known ? error.message : '暂时无法处理本次提问。' },
      { status: known ? error.status : 500, headers });
  }
}
