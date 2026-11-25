import { libraryExtensions, libraryIdPattern, libraryMaxBytes as BV_MAX_FILE_BYTES, modelExtension, modelKind } from './formats.ts';

function modelApi(id: string) {
  return libraryIdPattern.test(id) ? '/api/library/' + id : '/api/models/' + id;
}

export interface CloudModelDescriptor { kind: 'bvzip' | 'ifc' | 'geometry'; fileName: string; size: number; downloadUrl: string; sha256: string }
type Fetch = (input: string, init: RequestInit) => Promise<Response>;
export function cloudModelId(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error('模型编号无效，请从项目列表重新打开。');
  return value.toLowerCase();
}
/** Only the site's dedicated static viewer can opt into a protected model ID.
 * The normal local web page and the Electron app never gain URL-open behavior. */
export function cloudModelFromLocation(location: Pick<Location, 'protocol' | 'pathname' | 'hash'>, desktop: boolean): string | null {
  if (desktop || !['https:', 'http:'].includes(location.protocol) || location.pathname !== '/bim-viewer/index.html') return null;
  const params = new URLSearchParams(location.hash.slice(1));
  if (!params.has('modelId')) return null;
  if (params.getAll('modelId').length !== 1 || [...params.keys()].some(key => key !== 'modelId')) throw new Error('模型链接无效，请从项目列表重新打开。');
  return cloudModelId(params.get('modelId')!);
}
export function validateCloudDescriptor(value: unknown, modelId: string): CloudModelDescriptor {
  const id = cloudModelId(modelId);
  if (!value || typeof value !== 'object') throw new Error('模型下载信息无效。');
  const row = value as Partial<CloudModelDescriptor>;
  const name = row.fileName;
  if (typeof name !== 'string' || name.length > 255 || /[\\/\u0000-\u001f\u007f]/u.test(name)
    || !libraryExtensions.includes(modelExtension(name)) || modelKind(name) !== row.kind
    || (row.kind === 'geometry' && !libraryIdPattern.test(id))
    || !Number.isSafeInteger(row.size) || row.size! <= 0 || row.size! > BV_MAX_FILE_BYTES
    || typeof row.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(row.sha256)
    || row.downloadUrl !== modelApi(id) + '/content') throw new Error('模型下载信息或文件大小不符合要求。');
  return row as CloudModelDescriptor;
}
function httpError(response: Response, phase: string): Error {
  if (response.status === 401) return new Error('登录已失效，请返回网站重新登录后打开模型。');
  if (response.status === 403 || response.status === 404) return new Error('模型不存在，或当前账号没有查看权限。');
  return new Error(`${phase}失败（HTTP ${response.status}），请稍后重试。`);
}
/** The origin comes from the site's build configuration, never a model link.
 * The server independently binds this signed object path to the owning user. */
export function validateCloudGrant(value: unknown, storageOrigin: string, libraryFile?: { id: string; sha256: string; fileName: string }): string {
  const invalid = () => new Error('模型下载授权无效，请返回网站重新打开模型。');
  let origin: URL;
  try { origin = new URL(storageOrigin); } catch { throw invalid(); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  if (origin.origin !== storageOrigin || (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && loopback))) throw invalid();
  if (!value || typeof value !== 'object') throw invalid();
  const grant = value as { url?: unknown; expiresIn?: unknown };
  if (grant.expiresIn !== 60 || typeof grant.url !== 'string' || grant.url.length > 8192 || /[\\\s]/u.test(grant.url)) throw invalid();
  let url: URL;
  try { url = new URL(grant.url); } catch { throw invalid(); }
  const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  let expectedPath = new RegExp('^/storage/v1/object/sign/bim-models/' + uuid + '/(?:bv/' + uuid + '\\.zip|ifc/' + uuid + '\\.ifc)$', 'i');
  if (libraryFile) {
    if (!libraryIdPattern.test(libraryFile.id) || !/^[a-f0-9]{64}$/.test(libraryFile.sha256)) throw invalid();
    const bytes = new TextEncoder().encode(libraryFile.fileName);
    const encoded = btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
    expectedPath = new RegExp('^/storage/v1/object/sign/bim-models/' + uuid + '/library/' + libraryFile.id + '\\.' + libraryFile.sha256 + '\\.' + encoded + '$');
  }
  if (url.origin !== storageOrigin || url.username || url.password || url.hash || !expectedPath.test(url.pathname)
    || [...url.searchParams.keys()].length !== 1 || url.searchParams.getAll('token').length !== 1
    || !url.searchParams.get('token') || url.searchParams.get('token')!.length > 4096) throw invalid();
  return url.href;
}
/** One bounded full download, then the same local File/Worker import as desktop.
 * The same-origin API grants a short-lived, fixed-origin storage URL; bytes do
 * not pass through the site's function response limit. */
export async function downloadCloudModel(modelId: string, options: {
  signal: AbortSignal; storageOrigin: string; onProgress?: (received: number, total: number) => void; fetch?: Fetch;
}): Promise<File> {
  const id = cloudModelId(modelId), request = options.fetch ?? fetch;
  const init: RequestInit = { method: 'GET', credentials: 'same-origin', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal: options.signal };
  options.signal.throwIfAborted();
  const metadata = await request(modelApi(id) + '/viewer', init);
  if (!metadata.ok) throw httpError(metadata, '读取模型信息');
  const descriptor = validateCloudDescriptor(await metadata.json().catch(() => { throw new Error('模型下载信息无效，请稍后重试。'); }), id);
  options.signal.throwIfAborted();
  const grantResponse = await request(descriptor.downloadUrl, init);
  if (!grantResponse.ok) throw httpError(grantResponse, '获取模型下载授权');
  const grant = await grantResponse.json().catch(() => { throw new Error('模型下载授权无效，请返回网站重新打开模型。'); });
  const storageUrl = validateCloudGrant(grant, options.storageOrigin, libraryIdPattern.test(id) ? { id, ...descriptor } : undefined);
  options.signal.throwIfAborted();
  const response = await request(storageUrl, { ...init, credentials: 'omit' });
  if (!response.ok) throw httpError(response, '下载模型');
  const declaredLength = response.headers.get('Content-Length');
  if (declaredLength !== null && (!/^\d+$/u.test(declaredLength) || Number(declaredLength) !== descriptor.size)) {
    await response.body?.cancel(); throw new Error('模型下载大小与记录不一致，请重新打开。');
  }
  if (!response.body) throw new Error('模型下载没有返回文件内容。');
  const reader = response.body.getReader(), parts: Uint8Array<ArrayBuffer>[] = [];
  const abort = () => { void reader.cancel(options.signal.reason).catch(() => {}); };
  options.signal.addEventListener('abort', abort, { once: true });
  let received = 0;
  try {
    options.onProgress?.(0, descriptor.size);
    for (;;) {
      options.signal.throwIfAborted();
      const { value, done } = await reader.read();
      options.signal.throwIfAborted();
      if (done) break;
      received += value.byteLength;
      if (received > descriptor.size || received > BV_MAX_FILE_BYTES) throw new Error('模型下载超过记录大小或当前文件上限。');
      parts.push(value as Uint8Array<ArrayBuffer>);
      options.onProgress?.(received, descriptor.size);
    }
    if (received !== descriptor.size) throw new Error('模型下载不完整，请重试。');
    const file = new File(parts, descriptor.fileName, { type: descriptor.kind === 'ifc' ? 'application/x-step' : descriptor.kind === 'bvzip' ? 'application/zip' : 'application/octet-stream' });
    parts.length = 0;
    options.signal.throwIfAborted();
    if (!globalThis.crypto?.subtle) throw new Error('浏览器不支持文件校验，请使用 HTTPS 网站或本机地址。');
    // WebCrypto needs a contiguous input buffer: at most one extra admitted
    // compressed-file-sized buffer (bounded by BV_MAX_FILE_BYTES), released
    // before Worker parsing.
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    options.signal.throwIfAborted();
    const actual = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
    if (actual !== descriptor.sha256.toLowerCase()) throw new Error('模型文件校验失败，存储内容与上传记录不一致，请重新上传。');
    return file;
  } catch (error) {
    await reader.cancel(error).catch(() => {}); throw error;
  } finally {
    options.signal.removeEventListener('abort', abort); reader.releaseLock();
  }
}
