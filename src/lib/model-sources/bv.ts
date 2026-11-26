import { ModelArchive, jsonRecords, parseQuantitySnapshot, type ComponentRecord } from './runtime/evidence.mjs';

const MiB = 1024 * 1024;
const safeId = (value: unknown) => {
  if (typeof value !== 'string' && !(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)) throw new Error('构件标识无效。');
  const id = String(value);
  if (!id || id.length > 1024 || ['__proto__', 'constructor', 'prototype'].includes(id)) throw new Error('构件标识无效。');
  return id;
};
function row(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('模型记录结构无效。');
  return value as Record<string, unknown>;
}
function label(value: unknown, fallback: string) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).slice(0, 4096) : fallback;
}

export async function readBvRecords(bytes: Uint8Array, name: string, signal: AbortSignal) {
  const archive = new ModelArchive(bytes, {
    compressedBytes: 50 * MiB, uncompressedBytes: 1536 * MiB, entryBytes: 512 * MiB,
    entries: 6000, memoryBytes: 192 * MiB, heapBytes: 128 * MiB,
  });
  const entries = await archive.inspect();
  const shards = entries.filter(e => /(?:^|\/)components\/components[^/]*\.json$/.test(e.name));
  const prefixes = new Set(shards.map(e => e.name.slice(0, e.name.lastIndexOf('components/'))));
  if (prefixes.size !== 1) throw new Error('请选择包含单个 BRIGHT VISION 模型的 ZIP 文件。');
  const [prefix] = prefixes;
  const manifest = entries.find(e => e.name === prefix + 'manifest.json');
  if (!manifest || manifest.originalSize > MiB) throw new Error('模型缺少有效的 BV 格式声明。');
  const info: Record<string, unknown> = Object.create(null);
  for await (const [key, value] of jsonRecords(archive.chunks(manifest), false, 'manifest.json', { maxRecordCharacters: MiB })) {
    if (Object.hasOwn(info, key)) throw new Error('模型包声明存在重复字段。');
    info[key] = value;
  }
  if (info.schema !== 'Bright.Vision.Model/1') throw new Error('此 ZIP 不属于支持的 BRIGHT VISION 模型格式。');
  const levelFile = entries.find(e => e.name === prefix + 'LevelInfo.json');
  const selectedSize = shards.reduce((sum, entry) => sum + entry.originalSize, levelFile?.originalSize ?? 0);
  if (selectedSize > 96 * MiB) throw new Error('构件资料超过服务器读取上限，请按楼栋拆分模型。');
  const components = new Map<string, ComponentRecord>();
  for (const entry of shards) {
    for await (const [, value] of jsonRecords(archive.chunks(entry), true, entry.name, { maxRecordCharacters: MiB })) {
      signal.throwIfAborted();
      const raw = row(value);
      const id = safeId(raw.Id);
      if (components.size >= 60000) throw new Error('构件数超过 60000，请按楼栋拆分模型。');
      if (components.has(id) || !Array.isArray(raw.Nodes)) throw new Error('构件重复或缺少节点记录。');
      const metric = parseQuantitySnapshot(raw.QuantitySnapshot);
      components.set(id, { id, name: label(raw.name, id), category: label(raw.type, label(raw.BuildInCategory, '未分类')),
        levelNames: [], quantitySnapshot: metric.snapshot, quantityIssue: metric.issue });
    }
  }
  if (!components.size || (info.components !== undefined && info.components !== components.size)) throw new Error('模型声明和实际构件数量不符。');
  if (levelFile) {
    const levels = new Set<string>();
    let memberships = 0;
    for await (const [level, value] of jsonRecords(archive.chunks(levelFile), false, 'LevelInfo.json', { maxRecordCharacters: 8 * MiB })) {
      signal.throwIfAborted();
      if (levels.has(level) || levels.size >= 2000 || level.length > 1024) throw new Error('模型楼层索引无效或过大。');
      levels.add(level);
      const groups = row(row(value).elements ?? {});
      const seen = new Set<string>();
      for (const items of Object.values(groups)) {
        if (!Array.isArray(items)) throw new Error('楼层分类构件应为数组。');
        for (const item of items) {
          const id = safeId(row(item).id);
          const component = components.get(id);
          if (component && !seen.has(id)) {
            if (++memberships > 300000) throw new Error('楼层构件关联超过读取上限，请按楼栋拆分模型。');
            component.levelNames.push(level);
            seen.add(id);
          }
        }
      }
    }
  }
  return { name, components: [...components.values()] };
}
