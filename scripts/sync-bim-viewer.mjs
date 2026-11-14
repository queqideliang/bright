// Default: verify/extract a tracked static release using only this web checkout.
// Explicit --refresh: rebuild the shared workspace viewer and update that release.
// Only program assets/licenses are packaged; never models or environment files.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';

const generator = 'web/scripts/sync-bim-viewer.mjs';
const marker = '.generated-by-bv-sync.json';
const archiveName = 'bim-viewer-web.json.gz', manifestName = 'bim-viewer-web.manifest.json';
const maxArchiveBytes = 32 * 1024 * 1024, maxJsonBytes = 64 * 1024 * 1024, maxFileBytes = 16 * 1024 * 1024;
const licenseNames = ['LICENSE', 'NOTICE', 'THIRD-PARTY-NOTICES.md', 'fflate-LICENSE.txt', 'three-LICENSE.txt', 'versions.json', 'vite-LICENSE.txt'];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function permittedPath(name) {
  return typeof name === 'string' && (name === 'index.html'
    || /^assets\/(?:index|model\.worker|ifc\.worker|web-ifc-api|component-index\.worker|vim-export\.worker|format-export\.worker|brand-symbol)-[\w-]+\.(?:js|css|svg)$/u.test(name)
    || name === 'wasm/web-ifc.wasm'
    || name === 'licenses/web-ifc-LICENSE.txt'
    || licenseNames.some(license => name === `licenses/${license}`));
}

export function decodeRelease(archive, manifest) {
  assert(manifest?.schema === 1 && typeof manifest.version === 'string', 'Invalid release manifest');
  assert.equal(manifest.archive?.file, archiveName, 'Unexpected archive name');
  assert(archive.length > 0 && archive.length <= maxArchiveBytes, 'Archive exceeds limit');
  assert.equal(archive.length, manifest.archive.bytes, 'Archive size mismatch');
  assert.equal(sha256(archive), manifest.archive.sha256, 'Archive hash mismatch');
  const json = gunzipSync(archive, { maxOutputLength: maxJsonBytes });
  assert.equal(json.length, manifest.archive.uncompressedBytes, 'Archive expansion mismatch');
  const release = JSON.parse(json.toString('utf8'));
  assert.equal(release.schema, 1); assert.equal(release.version, manifest.version);
  assert(Array.isArray(release.files) && release.files.length >= 14 && release.files.length <= 40 && Array.isArray(manifest.files), 'Unexpected static release file count');
  assert.equal(manifest.files.length, release.files.length);
  const seen = new Set();
  const files = release.files.map((file, index) => {
    assert(permittedPath(file.path) && !seen.has(file.path.toLowerCase()), 'Unexpected or duplicate asset path');
    seen.add(file.path.toLowerCase());
    assert(Number.isSafeInteger(file.bytes) && file.bytes > 0 && file.bytes <= maxFileBytes, 'Invalid asset size');
    assert(typeof file.base64 === 'string' && file.base64.length <= Math.ceil(maxFileBytes / 3) * 4, 'Invalid encoded asset');
    const bytes = Buffer.from(file.base64, 'base64');
    assert.equal(bytes.toString('base64'), file.base64, 'Noncanonical base64');
    assert.equal(bytes.length, file.bytes, 'Asset size mismatch');
    assert.equal(sha256(bytes), file.sha256, 'Asset hash mismatch');
    assert.deepEqual(manifest.files[index], { path: file.path, bytes: file.bytes, sha256: file.sha256 }, 'Manifest file mismatch');
    return { path: file.path, bytes };
  });
  assert(seen.has('index.html') && [...seen].some(name => /^assets\/model\.worker-.*\.js$/u.test(name)), 'Missing viewer entry or Worker');
  for (const license of licenseNames) assert(seen.has(`licenses/${license}`.toLowerCase()), 'Missing required license');
  const ifcWorkers = [...seen].filter(name => /^assets\/ifc\.worker-.*\.js$/u.test(name));
  assert(ifcWorkers.length <= 1, 'Duplicate IFC Worker');
  if (ifcWorkers.length) assert(seen.has('wasm/web-ifc.wasm') && seen.has('licenses/web-ifc-license.txt'), 'IFC Worker requires WASM and its license');
  return files;
}

export function configuredOrigin(value, production) {
  let url;
  try { url = new URL(value); } catch { throw new Error('NEXT_PUBLIC_SUPABASE_URL must configure the viewer storage origin'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  assert(!url.username && !url.password && !url.search && !url.hash && url.pathname === '/', 'Storage configuration must be an origin');
  assert(url.protocol === 'https:' || (!production && url.protocol === 'http:' && loopback), 'Storage requires HTTPS; HTTP loopback is local-development only');
  return url.origin;
}

export function configureIndex(bytes, origin) {
  let html = bytes.toString('utf8');
  assert(!html.includes('bv-storage-origin'), 'Release index must not contain environment configuration');
  // The generic viewer/desktop CSP stays in the source release. The website copy
  // gets one configured origin and no development WebSocket permissions.
  const matches = html.match(/connect-src [^;]+;/gu);
  assert.equal(matches?.length, 1, 'Expected exactly one connect-src directive');
  assert(!/["'<>\s]/u.test(origin), 'Unsafe storage origin');
  html = html.replace(/connect-src [^;]+;/u, `connect-src 'self' ${origin};`);
  assert.equal((html.match(/<head>/gu) ?? []).length, 1);
  return Buffer.from(html.replace('<head>', `<head>\n    <meta name="bv-storage-origin" content="${origin}" />`));
}

async function walk(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(path.join(directory, prefix), { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await walk(directory, relative));
    else { assert(entry.isFile(), `Unexpected file type: ${relative}`); files.push(relative); }
  }
  return files.sort();
}

async function refresh(web) {
  const viewer = path.resolve(web, '../tools/bim-viewer');
  async function run(relative, args = []) {
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(viewer, relative), ...args], { cwd: viewer, stdio: 'inherit', windowsHide: true });
      child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Viewer build failed (${code}): ${relative}`)));
    });
  }
  await run('node_modules/typescript/bin/tsc', ['--noEmit']);
  await run('node_modules/vite/bin/vite.js', ['build']);
  await run('scripts/copy-notices.mjs');
  const version = JSON.parse(await readFile(path.join(viewer, 'package.json'), 'utf8')).version;
  const files = [];
  for (const name of await walk(path.join(viewer, 'dist'))) {
    assert(permittedPath(name), 'Refuse to package a non-program file');
    const bytes = await readFile(path.join(viewer, 'dist', name));
    files.push({ path: name, bytes: bytes.length, sha256: sha256(bytes), base64: bytes.toString('base64') });
  }
  const json = Buffer.from(JSON.stringify({ schema: 1, version, files }));
  const archive = gzipSync(json, { level: 9 });
  const sources = {};
  const sourceNames = [...(await walk(path.join(viewer, 'src'))).map(name => `src/${name}`),
    'index.html', 'vite.config.ts', 'tsconfig.json', 'package.json', 'package-lock.json',
    'scripts/copy-notices.mjs', 'LICENSE', 'NOTICE', 'THIRD-PARTY-NOTICES.md'];
  for (const name of sourceNames.sort()) sources[`tools/bim-viewer/${name}`] = sha256(await readFile(path.join(viewer, name)));
  sources['web/src/lib/bv/contracts.ts'] = sha256(await readFile(path.join(web, 'src/lib/bv/contracts.ts')));
  const manifest = { schema: 1, version, generator, archive: { file: archiveName, bytes: archive.length, sha256: sha256(archive), uncompressedBytes: json.length },
    files: files.map(({ base64, ...file }) => file), provenance: { refreshCommand: 'npm run viewer:refresh (full workspace)', sources } };
  decodeRelease(archive, manifest);
  const vendor = path.join(web, 'vendor'); await mkdir(vendor, { recursive: true });
  assert.equal(await realpath(vendor), vendor, 'Refuse a redirected vendor directory');
  // A stopped refresh leaves a hash mismatch and fails closed on the next sync.
  await writeFile(path.join(vendor, archiveName), archive);
  await writeFile(path.join(vendor, manifestName), JSON.stringify(manifest, null, 2) + '\n');
}

async function main() {
  const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const args = process.argv.slice(2);
  assert(new Set(args).size === args.length && args.every(arg => ['--refresh', '--production'].includes(arg)), 'Only --refresh and --production are supported');
  const production = args.includes('--production') || process.env.NODE_ENV === 'production';
  if (args.includes('--refresh')) await refresh(web);
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    // Available after npm ci in this checkout; no workspace dependency. Explicit
    // configuration also allows dependency-free extraction fixtures.
    const require = createRequire(path.join(web, 'package.json'));
    require('@next/env').loadEnvConfig(web, !production, { info() {}, error() {} });
  }
  const origin = configuredOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL, production);
  const manifest = JSON.parse(await readFile(path.join(web, 'vendor', manifestName), 'utf8'));
  const files = decodeRelease(await readFile(path.join(web, 'vendor', archiveName)), manifest);
  const publicRoot = path.join(web, 'public'), destination = path.join(publicRoot, 'bim-viewer');
  await mkdir(publicRoot, { recursive: true });
  assert.equal(await realpath(publicRoot), publicRoot, 'Refuse a redirected public directory');
  const stage = path.join(publicRoot, `.bim-viewer-stage-${randomUUID()}`);
  assert.equal(path.dirname(stage), publicRoot); assert.equal(path.dirname(destination), publicRoot);
  await mkdir(stage);
  let installed = false;
  try {
    const generated = [];
    for (const file of files) {
      const target = path.resolve(stage, file.path);
      assert(target.startsWith(stage + path.sep), 'Asset escaped staging directory');
      await mkdir(path.dirname(target), { recursive: true });
      const bytes = file.path === 'index.html' ? configureIndex(file.bytes, origin) : file.bytes;
      await writeFile(target, bytes);
      generated.push({ path: file.path, bytes: bytes.length, sha256: sha256(bytes) });
    }
    await writeFile(path.join(stage, marker), JSON.stringify({ generator, version: manifest.version, archiveSha256: manifest.archive.sha256, files: generated }, null, 2) + '\n');
    const existing = await lstat(destination).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (existing) {
      assert(existing.isDirectory() && !existing.isSymbolicLink(), 'Refuse to replace a redirected viewer directory');
      assert.equal(await realpath(destination), destination);
      const previous = JSON.parse(await readFile(path.join(destination, marker), 'utf8'));
      assert.equal(previous.generator, generator, 'Refuse to replace an unowned public directory');
      await rm(destination, { recursive: true });
    }
    await rename(stage, destination); installed = true;
    console.log(JSON.stringify({ result: 'PASS', version: manifest.version, generatedFiles: files.length, archiveSha256: manifest.archive.sha256, output: 'web/public/bim-viewer', modelsIncluded: false }));
  } finally {
    if (!installed && await lstat(stage).then(() => true, () => false)) {
      assert.equal(await realpath(stage), stage); assert.equal(path.dirname(stage), publicRoot);
      await rm(stage, { recursive: true });
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
