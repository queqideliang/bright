import { Unzip, UnzipInflate, unzipSync } from 'fflate';

/** Read only the named Open XML parts. Bound both declared and actual expanded sizes. */
export function readOfficeParts(bytes: Uint8Array, keep: (path: string) => boolean): Record<string, Uint8Array> {
  const parts: Record<string, Uint8Array> = Object.create(null);
  const names = new Map<string, number>();
  const limit = 32 * 1024 * 1024;
  const partLimit = 12 * 1024 * 1024;
  let count = 0, declared = 0, expanded = 0;
  unzipSync(bytes, { filter: entry => {
    if (++count > 2000 || entry.name.length > 1024) throw new Error('Office 文件包含过多条目，请拆分文件。');
    if (keep(entry.name)) {
      if (names.has(entry.name)) throw new Error('Office 文件包含重复的 XML 部件。');
      declared += entry.originalSize;
      if (entry.originalSize > partLimit || declared > limit) throw new Error('Office 正文解压后过大，请按章节拆分。');
      names.set(entry.name, entry.originalSize);
    }
    return false;
  } });
  const seen = new Set<string>();
  const stream = new Unzip(file => {
    if (!keep(file.name)) return;
    const expected = names.get(file.name);
    if (expected === undefined || seen.has(file.name)) throw new Error('Office 文件目录与正文不一致。');
    seen.add(file.name);
    const output = new Uint8Array(expected);
    let offset = 0;
    file.ondata = (error, chunk, final) => {
      if (error) throw error;
      expanded += chunk.byteLength;
      if (expanded > limit || offset + chunk.byteLength > expected) throw new Error('Office 正文超出声明的解压大小。');
      output.set(chunk, offset);
      offset += chunk.byteLength;
      if (final) {
        if (offset !== expected) throw new Error('Office 文件正文不完整。');
        parts[file.name] = output;
      }
    };
    file.start();
  });
  stream.register(UnzipInflate);
  for (let offset = 0; offset < bytes.length; offset += 2048) {
    const end = Math.min(offset + 2048, bytes.length);
    stream.push(bytes.subarray(offset, end), end === bytes.length);
  }
  if (Object.keys(parts).length !== names.size) throw new Error('Office 文件包含无法读取的部件。');
  return parts;
}
