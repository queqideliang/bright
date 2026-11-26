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
  const metric = (value,unit) => ({unit,value,available:1,missing:0,invalid:0,unavailable:0,overflow:false});
  const fact = {scope:'category',category:'墙',level:null,components:2,objects:1,identifiedObjects:1,source:'revit-parameters',
    metrics:{length:metric(3,'m'),area:metric(4.5,'m2'),volume:metric(1,'m3')}};
  const model = {title:'结构模型.zip',kind:'model',passages:[{location:'类别：墙',text:'墙的来源去重面积为 4.5 m²。',fact}]};
  const withUntrustedFact = {...doc,passages:doc.passages.map(p=>({...p,fact}))};
  const withModel = await collection.POST(req('POST',{...body,documents:[model,withUntrustedFact]}));
  assert.equal(withModel.status,201);
  const modelId = (await withModel.json()).share.id;
  const modelParams = {params:Promise.resolve({id:modelId})};
  globalThis.account = guest;
  assert.deepEqual((await (await item.GET(req('GET'),modelParams)).json()).share.documents,[model,doc]);
  globalThis.account = owner;
  assert.equal((await item.DELETE(req('DELETE'),modelParams)).status,200);
  const invalidModel = {...model,passages:[{...model.passages[0],fact:{...fact,objects:-2}}]};
  assert.equal((await collection.POST(req('POST',{...body,documents:[invalidModel]}))).status,400);
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
  let quotaReached = false;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(url.hostname, 'fake.invalid');
    const input = JSON.parse(JSON.parse(init.body).messages[1].content);
    assert.equal(input.documents[0].text, doc.passages[0].text);
    if (quotaReached) return new Response('', { status: 429 });
    return Response.json({ choices: [{ message: { content: '{"supported":true,"answer":"QA8。[S1]"}' } }] });
  };
  const question = { question: '交付编号？', shareId: share.id };
  const result = await (await ask.POST(req('POST', question))).json();
  assert.equal(result.answer, 'QA8。[S1]');
  assert.equal(result.sources[0].location, '页 1');
  quotaReached = true;
  const limited = await (await ask.POST(req('POST', question))).json();
  assert.equal(limited.mode, 'extractive');
  assert.match(limited.answer, /交付编号为 QA8/u);
  assert.match(limited.answer, /\[S1\]/);
  assert.equal(limited.sources[0].text, doc.passages[0].text);
  assert.equal((await ask.POST(req('POST', { ...question, documents: [doc] }))).status, 400);
  globalThis.account = owner;
  assert.equal((await item.DELETE(req('DELETE'), params)).status, 200);
  globalThis.account = guest;
  assert.equal((await item.GET(req('GET'), params)).status, 404);
  assert.equal((await ask.POST(req('POST', question))).status, 404);
  assert.equal(calls, 2);
  assert.equal(storage.size, 0);
});
