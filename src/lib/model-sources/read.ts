import { createHash } from 'node:crypto';
import { accountStorage, findLibraryItem, libraryGrant } from '../model-library/storage.ts';
import { modelKind } from '../model-library/formats.ts';
import { readBvRecords } from './bv.ts';
import { buildModelQaDocument } from './runtime/evidence.mjs';

export class SourceError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

async function verifiedFile(url: string, size: number, sha256: string, signal: AbortSignal) {
  const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal });
  if (!response.ok || !response.body) throw new SourceError('模型文件暂时无法读取。', 503);
  const expected = response.headers.get('content-length');
  if (expected !== null && Number(expected) !== size) {
    await response.body.cancel();
    throw new SourceError('模型文件大小与库记录不符。', 409);
  }
  const out = new Uint8Array(size);
  const hash = createHash('sha256');
  const reader = response.body.getReader();
  let offset = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      if (done) break;
      if (value.length > size - offset) throw new SourceError('模型文件大小超过库记录。', 409);
      out.set(value, offset); offset += value.length; hash.update(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  if (offset !== size || hash.digest('hex') !== sha256) throw new SourceError('模型文件完整性校验失败，请重新上传原文件。', 409);
  return out;
}

export async function readModelSource(id: string, signal: AbortSignal) {
  const store = await accountStorage();
  const item = await findLibraryItem(store, id);
  if (!item) throw new SourceError('模型不存在或不属于当前账号。', 404);
  const kind = modelKind(item.name);
  if (kind === 'geometry') throw new SourceError('此几何格式缺少受支持的工程量来源，请选择 IFC 或 BV ZIP 模型。', 415);
  const ifcSizeLimit = 16 * 1024 * 1024;
  if (kind === 'ifc' && item.size > ifcSizeLimit) throw new SourceError('此 IFC 超过云端资料提取的 16 MiB 上限，请使用工作台打开或拆分模型。', 413);
  const { url } = await libraryGrant(store, item);
  const bytes = await verifiedFile(url, item.size, item.sha256, signal);
  signal.throwIfAborted();
  try {
    const model = kind === 'bvzip' ? await readBvRecords(bytes, item.name, signal) :
      await (await import('./runtime/ifc.mjs')).parseIfc(bytes, item.name, {
        metadataOnly: true,
        limits: { fileBytes: ifcSizeLimit, products: 35000, lines: 350000, propertyValues: 250000, propertyTextBytes: 16 * 1024 * 1024 },
      });
    signal.throwIfAborted();
    const document = await buildModelQaDocument(model, { signal });
    if (Buffer.byteLength(JSON.stringify(document)) > 4 * 1024 * 1024) {
      throw new Error('模型统计资料超过单次读取上限，请按楼栋拆分模型。');
    }
    return document;
  } catch (error) {
    if (signal.aborted) throw new SourceError('模型资料读取超时或已取消，请稍后再试。', 504);
    const reason = error instanceof Error ? error.message : '模型格式不受支持。';
    if (/Cannot find module|ENOENT|cannot resolve|failed to.*wasm/i.test(reason)) {
      throw new SourceError('服务器的模型解析器暂时不可用。', 503);
    }
    throw new SourceError(reason.slice(0, 300), /上限|超过|预算|过大|限制/.test(reason) ? 413 : 422);
  }
}
