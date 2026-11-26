import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

const auth = 'export async function createClient(){return {auth:{getUser:async()=>({data:{user:globalThis.account}})}}} export function createAdminClient(){return {storage:{from:globalThis.bucket}}}';
registerHooks({ resolve(specifier, context, next) {
  return specifier === '@/lib/supabase/server' ? { url: 'data:text/javascript,' + encodeURIComponent(auth), shortCircuit: true } : next(specifier, context);
} });
const collection = await import('./route.ts');
const item = await import('./[id]/route.ts');
const ask = await import('../ask/route.ts');
const origin = 'https://qa.invalid';
function req(method, body) {
  return new Request(origin + '/api/workbench/shares', {
    method, headers: { origin, 'content-type': 'application/json' }, body: body && JSON.stringify(body),
  });
}
test('created snapshots are private to the owner list, accessible by capability, and revocable for future reads and answers', async () => {
  const storage = new Map();
  globalThis.bucket = name => {
    assert.equal(name, 'bv-workbench-shares');
    return {
      async list(dir, options) {
        return { data: [...storage.keys()].filter(k => k.startsWith(dir + '/')).map(k => ({ name: k.slice(dir.length + 1), created_at: '2026-11-26' }))
          .filter(row => row.name.includes(options.search ?? '')).slice(options.offset ?? 0, (options.offset ?? 0) + options.limit) };
      },
      async upload(path, bytes, options) { assert.equal(options.upsert, false); storage.set(path, bytes); return {}; },
      async remove(paths) { assert.equal(paths.length, 1); storage.delete(paths[0]); return {}; },
      async download(path) { return { data: new Blob([storage.get(path)]) }; },
    };
  };
  const owner = { id: randomUUID() }, guest = { id: randomUUID() };
  const doc = { title: '建筑交付', passages: [{ location: '页 1', text: '交付编号为 QA8。' }] };
  const body = { owner: owner.id, title: '合成项目', documents: [doc] };
  globalThis.account = null;
  assert.equal((await collection.GET(req('GET'))).status, 401);
  globalThis.account = guest;
  assert.equal((await collection.POST(req('POST', body))).status, 403);
  globalThis.account = owner;
  const created = await collection.POST(req('POST', body));
  assert.equal(created.status, 201);
  const { share } = await created.json();
  assert.match(share.id, /^[a-f0-9-]{36}\.[A-Za-z0-9_-]{24}$/);
  assert.equal(share.passageCount, 1);
  assert.equal((await (await collection.GET(req('GET'))).json()).shares[0].id, share.id);
  const params = { params: Promise.resolve({ id: share.id }) };
  globalThis.account = guest;
  assert.deepEqual((await (await collection.GET(req('GET'))).json()).shares, []);
  const retrieved = await item.GET(req('GET'), params);
  assert.equal(retrieved.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual((await retrieved.json()).share.documents, [doc]);
  assert.equal((await item.DELETE(req('DELETE'), params)).status, 403);
  process.env.DASHSCOPE_API_KEY = 'mock';
  process.env.DASHSCOPE_BASE_URL = 'https://fake.invalid/test';
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(url.hostname, 'fake.invalid');
    const input = JSON.parse(JSON.parse(init.body).messages[1].content);
    assert.equal(input.documents[0].text, doc.passages[0].text);
    return Response.json({ choices: [{ message: { content: '{"supported":true,"answer":"QA8。[S1]"}' } }] });
  };
  const question = { question: '交付编号？', shareId: share.id };
  const result = await (await ask.POST(req('POST', question))).json();
  assert.equal(result.answer, 'QA8。[S1]');
  assert.equal(result.sources[0].location, '页 1');
  assert.equal((await ask.POST(req('POST', { ...question, documents: [doc] }))).status, 400);
  globalThis.account = owner;
  assert.equal((await item.DELETE(req('DELETE'), params)).status, 200);
  globalThis.account = guest;
  assert.equal((await item.GET(req('GET'), params)).status, 404);
  assert.equal((await ask.POST(req('POST', question))).status, 404);
  assert.equal(calls, 1);
  assert.equal(storage.size, 0);
});
