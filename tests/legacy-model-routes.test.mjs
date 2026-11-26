import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

import { POST as upload } from '../src/app/api/upload/route.ts';
import { POST as uploadUrl } from '../src/app/api/upload-url/route.ts';
import { POST as finishUpload } from '../src/app/api/upload-complete/route.ts';
import { POST as legacyTransport } from '../src/app/api/upload-to-speckle/route.ts';
import { GET as importStatus } from '../src/app/api/import-status/[jobId]/route.ts';

const fixtures = {
  '@/lib/supabase/server': 'export const createClient = () => globalThis.archiveClient;',
  '@/lib/supabase/middleware': 'export const updateSession = () => { throw Error("unexpected auth call"); };',
};
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'next/server') return next('next/server.js', context);
    if (Object.hasOwn(fixtures, specifier)) {
      return { url: 'data:text/javascript,' + encodeURIComponent(fixtures[specifier]), shortCircuit: true };
    }
    return next(specifier, context);
  },
});
const { POST: runReview, GET: archive } = await import('../src/app/api/compliance/route.ts');
const { GET: extractStatus, POST: extract } = await import('../src/app/api/extract/route.ts');
const { POST: chat } = await import('../src/app/api/chat/route.ts');
const { proxy } = await import('../src/proxy.ts');
const { NextRequest } = await import('next/server.js');

test('retired model operations give a local destination without consuming input or calling upstream', async () => {
  for (const operation of [upload, uploadUrl, finishUpload, legacyTransport, importStatus]) {
    const response = operation();
    assert.equal(response.status, 410);
    assert.equal(response.headers.get('location'), null);
    const data = await response.json();
    assert.equal(data.libraryUrl, '/models');
    assert.equal(data.workbenchUrl, '/workbench');
    assert.ok(data.error);
  }
});

test('legacy bookmarks resolve before auth and discard identifiers belonging to the old service', async () => {
  for (const [path, target] of [['/dashboard', '/models'], ['/viewer', '/workbench'], ['/demo', '/workbench']]) {
    const request = new NextRequest('https://example.invalid' + path + '?stream=synthetic');
    const response = await proxy(request);
    assert.equal(response.status, 307);
    assert.equal(response.headers.get('location'), 'https://example.invalid' + target);
  }
});

test('archived compliance and extraction are scoped to the owner and only use stored data', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  delete process.env.NEXT_PUBLIC_VPS_API_URL;
  delete process.env.VPS_SECRET_TOKEN;
  let owner;
  let report;
  globalThis.archiveClient = {
    auth: { async getUser() { return { data: { user: owner && { id: owner } } }; } },
    from(table) {
      assert.equal(table, 'models');
      const filters = new Map();
      return {
        select(fields) { assert.match(fields, /projects!inner\(user_id\)/); return this; },
        eq(key, value) { filters.set(key, value); return this; },
        async single() {
          assert.equal(filters.get('id'), 'archived-1');
          assert.equal(filters.get('projects.user_id'), owner);
          return { data: owner === 'owner' ? { id: 'archived-1', name: 'sample.ifc', audit_json: report, status: 'PARSING' } : null };
        },
        update(values) { assert.equal(values.status, 'COMPLETED'); return this; },
      };
    },
  };
  const request = new NextRequest('https://example.invalid/api/compliance?modelId=archived-1');
  assert.equal((await archive(request)).status, 401);
  owner = 'other';
  assert.equal((await archive(request)).status, 404);
  owner = 'owner';
  let response = await archive(request);
  assert.equal((await response.json()).status, 'no_report');
  const post = (body) => new Request(request.url, { method: 'POST', body: JSON.stringify(body) });
  assert.equal((await runReview(post({ modelId: 'archived-1' }))).status, 410);
  assert.equal((await extract(post({ projectId: 'archived-1' }))).status, 410);
  report = { checked: 5 };
  response = await archive(request);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await response.json(), { status: 'completed', report });
  assert.deepEqual(await (await runReview(post({ modelId: 'archived-1' }))).json(), { status: 'completed', report });
  process.env.NEXT_PUBLIC_VPS_API_URL = 'https://archive.invalid';
  process.env.VPS_SECRET_TOKEN = 'fixture';
  globalThis.fetch = async (url, init) => {
    assert.equal(init.headers['X-VPS-Token'], 'fixture');
    if (url === 'https://archive.invalid/project/archived-1/summary') return Response.json({ total_elements: 42 });
    assert.equal(url, 'https://archive.invalid/compliance-check');
    assert.equal(JSON.parse(init.body).model_id, 'archived-1');
    return Response.json({ checked: 42 });
  };
  const status = await extractStatus(new Request('https://example.invalid/api/extract?projectId=archived-1'));
  assert.equal((await status.json()).summary.total_elements, 42);
  assert.deepEqual(await (await extract(post({ projectId: 'archived-1' }))).json(), { status: 'ready' });
  assert.deepEqual(await (await runReview(post({ modelId: 'archived-1' }))).json(), { status: 'completed', report: { checked: 42 } });
});

test('legacy chat uses the signed-in caller’s model data and retains the Gemini answer contract', async (t) => {
  const previous = globalThis.fetch;
  t.after(() => { globalThis.fetch = previous; });
  let user = null;
  globalThis.archiveClient = { auth: { async getUser() { return { data: { user } }; } } };
  const request = () => new Request('https://example.invalid/api/chat', {
    method: 'POST', body: JSON.stringify({ question: '墙体积？', modelData: { total: 52 } }),
  });
  assert.equal((await chat(request())).status, 401);
  user = { id: 'owner' };
  process.env.GEMINI_API_KEY = 'fixture';
  globalThis.fetch = async (url, init) => {
    assert.equal(new URL(url).hostname, 'generativelanguage.googleapis.com');
    assert.equal(init.headers['x-goog-api-key'], 'fixture');
    assert.match(init.body, /52/);
    return Response.json({ candidates: [{ content: { parts: [{ text: '52' }] } }] });
  };
  assert.deepEqual(await (await chat(request())).json(), { answer: '52', source: 'gemini' });
});
