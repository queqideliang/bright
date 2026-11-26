import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

// This suite runs in a dedicated Node test process, with no network or credential access.
const auth = 'export async function createClient(){return {auth:{getUser:async()=>({data:{user:globalThis.testAccount}})}}} export function createAdminClient(){throw Error("unexpected storage call")}';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@/lib/supabase/server') {
      return { url: 'data:text/javascript,' + encodeURIComponent(auth), shortCircuit: true };
    }
    return next(specifier, context);
  },
});
const { POST } = await import('./route.ts');
const url = 'https://testing.invalid/api/workbench/ask';
const data = { question: '墙有多少？', context: { levels: ['一层'], categories: ['墙'] } };
const plan = { intent: 'components', category: '墙' };
const source = { id: 'S1', title: '交付要求', location: '第 3 页', text: '墙须填交付编码。' };
function request(body, origin = 'https://testing.invalid') {
  return new Request(url, {
    method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

test('authenticated workbench queries, documents and provider boundaries', async () => {
  delete process.env.DASHSCOPE_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
  process.env.DASHSCOPE_BASE_URL = 'https://model.test/v1';
  process.env.DASHSCOPE_MODEL = 'test-model';
  let calls = 0;
  let completion = { plan };
  globalThis.fetch = async (url, init) => {
    calls++;
    const input = JSON.parse(init.body);
    if (url.hostname === 'model.test') {
      assert.equal(input.model, 'test-model');
      assert.equal(init.headers.Authorization, 'Bearer fake-qwen');
      return Response.json({ choices: [{ message: { content: JSON.stringify(completion) } }] });
    }
    assert.equal(url.hostname, 'generativelanguage.googleapis.com');
    assert.equal(init.headers['x-goog-api-key'], 'fake-gemini');
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(completion) }] } }] });
  };
  globalThis.testAccount = null;
  assert.equal((await POST(request(data))).status, 401);
  const proxied = request(data, 'https://workbench.example');
  proxied.headers.set('host', 'workbench.example');
  assert.equal((await POST(proxied)).status, 401);
  globalThis.testAccount = { id: 'qa' };
  assert.equal((await POST(request(data, 'https://another.invalid'))).status, 403);
  assert.equal((await POST(request({ ...data, extra: 'x'.repeat(50000) }))).status, 413);
  assert.equal((await POST(request({ ...data, owner: 'other-qa' }))).status, 403);
  assert.equal((await POST(request({ question: '依据？', documents: [source, source] }))).status, 400);
  assert.equal((await POST(request(data))).status, 503);
  assert.equal(calls, 0);
  process.env.DASHSCOPE_API_KEY = 'fake-qwen';
  process.env.GEMINI_API_KEY = 'fake-gemini';
  assert.deepEqual(await (await POST(request(data))).json(), { plan });
  const evidence = { ...data, plan, result: { status: 'ok', matchedRecords: 3 } };
  completion = { answer: '3 个构件。' };
  assert.deepEqual(await (await POST(request(evidence))).json(), completion);
  completion = { plan: { ...plan, extra: 'invalid' } };
  assert.equal((await POST(request(data))).status, 502);
  const docs = { question: '墙要填什么？', documents: [source] };
  completion = { supported: true, answer: '需填交付编码。[S1]' };
  assert.deepEqual(await (await POST(request(docs))).json(), { answer: completion.answer });
  completion = { supported: true, answer: '需填交付编码。[S8]' };
  assert.equal((await POST(request(docs))).status, 502);
  delete process.env.DASHSCOPE_API_KEY;
  completion = { supported: false };
  assert.match((await (await POST(request(docs))).json()).answer, /没有足够依据/);
  globalThis.testAccount = { id: 'quota' };
  completion = { plan };
  for (let i = 0; i < 20; i++) assert.equal((await POST(request(data))).status, 200);
  assert.equal((await POST(request(data))).status, 429);
});
