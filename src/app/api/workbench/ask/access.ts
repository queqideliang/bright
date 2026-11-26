import { AskError } from './contract.ts';

const usage = new Map<string, { expires: number; calls: number }>();

export function requireWorkbenchOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const url = new URL(request.url);
  const host = request.headers.get('host');
  if (!origin || (origin !== url.origin && !(host && origin === url.protocol + '//' + host))) {
    throw new AskError(403, '请从本站工作台发起请求。');
  }
}

export function checkRate(userId: string) {
  const now = Date.now();
  for (const [id, bucket] of usage) {
    if (bucket.expires > now) break;
    usage.delete(id);
  }
  const existing = usage.get(userId);
  if (existing) {
    if (existing.calls >= 20) throw new AskError(429, '请求过于频繁，请一分钟后再试。');
    existing.calls++;
  } else {
    usage.set(userId, { expires: now + 60_000, calls: 1 });
  }
}
