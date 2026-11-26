import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { strToU8, zipSync } from 'fflate';

const db = 'export const createClient=()=>globalThis.testSession;export const createAdminClient=()=>globalThis.testAdmin;';
registerHooks({ resolve(name, ctx, next) {
  if (name === '@/lib/supabase/server') return { url: 'data:text/javascript,' + encodeURIComponent(db), shortCircuit: true };
  if (name === './formats' && ctx.parentURL.endsWith('/model-library/storage.ts')) return next('./formats.ts', ctx);
  return next(name, ctx);
} });
const { GET } = await import('../src/app/api/workbench/model-sources/[id]/route.ts');
const modelId = '00000001-dead-8bee-9dad-deadbeef1234';
const owner = 'owner-fixture';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const request = () => GET(new Request('https://example.invalid/api/workbench/model-sources/' + modelId), { params: Promise.resolve({ id: modelId }) });
function fixture() {
  const quantity = { schemaVersion: 1, source: 'revit-parameters',
    sourceElement: { uniqueId: 'w1', elementId: '10', documentScope: 'A', linkInstanceScope: '' },
    metrics: {
      length: { parameter: 'CURVE_ELEM_LENGTH', unit: 'm', status: 'available', value: 0 },
      area: { parameter: 'HOST_AREA_COMPUTED', unit: 'm2', status: 'missing', value: null },
      volume: { parameter: 'HOST_VOLUME_COMPUTED', unit: 'm3', status: 'available', value: 12.75 },
    } };
  return zipSync({
    'manifest.json': strToU8(JSON.stringify({ schema: 'Bright.Vision.Model/1', components: 3 })),
    'components/components-0.json': strToU8(JSON.stringify([
      { Id: 'wallA', name: 'wall', type: '墙', Nodes: ['g'], QuantitySnapshot: quantity },
      { Id: 'wallCopy', name: 'wall', type: '墙', Nodes: ['g'], QuantitySnapshot: quantity },
      { Id: 'doorB', type: '门', Nodes: ['g'] },
    ])),
    'LevelInfo.json': strToU8(JSON.stringify({ '一层': { elements: { A: [{ id: 'wallA' }, { id: 'wallCopy' }, { id: 'doorB' }] } } })),
    'geometries/g.json': strToU8('PRIVATE_RAW_GEOMETRY'),
    'properties/p.json': strToU8('PRIVATE_RAW_PROPERTIES'),
  });
}

test('model sources use account storage and the verified original BV/IFC, without a viewer or model provider', async t => {
  const oldFetch = globalThis.fetch; t.after(() => { globalThis.fetch = oldFetch; });
  const origin = 'https://storage.invalid';
  process.env.NEXT_PUBLIC_SUPABASE_URL = origin;
  let user = null, filename = '试验.zip', bytes = fixture(), digest = hash(bytes), calls = 0, foreignURL = false;
  const key = () => modelId + '.' + digest + '.' + Buffer.from(filename).toString('base64url');
  const pathname = () => '/storage/v1/object/sign/bim-models/' + owner + '/library/' + key();
  globalThis.testSession = { auth: { async getUser() { return { data: { user } }; } } };
  globalThis.testAdmin = { storage: { from(name) {
    assert.equal(name, 'bim-models');
    return {
      async list(prefix, { search }) {
        assert.equal(prefix, user.id + '/library'); assert.equal(search, modelId + '.');
        return { data: user.id === owner ? [{ name: key(), metadata: { size: bytes.length } }] : [] };
      },
      async createSignedUrl(object, seconds) {
        assert.equal(object, owner + '/library/' + key()); assert.equal(seconds, 60);
        return { data: { signedUrl: (foreignURL ? 'https://outside.invalid' : origin) + pathname() + '?token=fixture' } };
      },
    };
  } } };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, origin + pathname() + '?token=fixture');
    assert.equal(options.redirect, 'error'); calls++;
    return new Response(bytes, { headers: { 'content-length': String(bytes.length) } });
  };
  assert.equal((await request()).status, 401);
  user = { id: 'second-account' };
  assert.equal((await request()).status, 404);
  user = { id: owner }; filename = 'drawing.obj';
  assert.equal((await request()).status, 415);
  filename = '试验.zip'; foreignURL = true;
  assert.equal((await request()).status, 502);
  assert.equal(calls, 0);
  foreignURL = false;
  let response = await request();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const { document } = await response.json();
  assert.equal(document.kind, 'model');
  assert.ok(document.title.includes('试验'));
  assert.ok(document.passages.every(p => typeof p.location === 'string' && typeof p.text === 'string'));
  const wall = document.passages.find(p => p.fact?.category === '墙' && p.fact?.scope === 'category');
  assert.equal(wall.fact.metrics.volume.value, 12.75);
  assert.equal(wall.fact.metrics.length.value, 0);
  assert.equal(wall.fact.metrics.area.value, null);
  assert.ok(document.passages.some(p => p.fact?.level === '一层'));
  assert.doesNotMatch(JSON.stringify(document), /PRIVATE_RAW|QuantitySnapshot|positions|storage\.invalid/);
  digest = '0'.repeat(64);
  assert.equal((await request()).status, 409);
  bytes = zipSync({ 'manifest.json': strToU8('{"schema":"other"}') }); digest = hash(bytes);
  assert.equal((await request()).status, 422);
  filename = 'test.ifc'; bytes = await readFile(new URL('./fixtures/model-source.ifc', import.meta.url)); digest = hash(bytes);
  response = await request();
  const result = await response.json();
  assert.equal(response.status, 200, result.error);
  assert.ok(result.document.passages.some(p => p.fact?.level === 'Level 1'));
  const ifcWall = result.document.passages.find(p => p.fact?.scope === 'category' && p.fact?.category === 'IfcWall');
  assert.equal(ifcWall.fact.ifcQuantities.find(q => q.name === 'NetVolume').value, 1.8);
  assert.equal(ifcWall.fact.ifcQuantities.find(q => q.name === 'Length').value, 2);
  assert.doesNotMatch(JSON.stringify(result.document), /IFCEXTRUDEDAREASOLID|IFCCARTESIANPOINT|positions/);
  bytes = Buffer.from(bytes.toString('utf8').replace('#34=IFCWALL(', '#34=IFCWALLSTANDARDCASE('));
  digest = hash(bytes);
  const multiple = await (await request()).json();
  const walls = multiple.document.passages.find(p => p.fact?.scope === 'category' && p.fact?.category === '墙体（全部墙类）');
  assert.equal(walls.fact.components, 3);
  assert.equal(walls.fact.ifcQuantities.find(q => q.name === 'NetVolume').value, 1.8);
});
