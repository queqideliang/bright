/* eslint-disable -- Generated from tools/bim-viewer by scripts/sync-model-source-runtime.mjs. */

// src/import/zip.ts
import { Inflate } from "fflate";

// src/import/capacity.ts
var MiB = 1024 ** 2;
var GiB = 1024 ** 3;
var MODEL_LIMITS = Object.freeze({
  compressedBytes: 16 * GiB,
  uncompressedBytes: 128 * GiB,
  entryBytes: 16 * GiB,
  entries: 1e6,
  components: 2e6,
  records: 8e6,
  metadataBytes: 64 * MiB,
  memoryBytes: 4 * GiB,
  heapBytes: 2 * GiB
});
function formatCapacityBytes(value) {
  if (value >= GiB) return `${Number((value / GiB).toFixed(2))} GiB`;
  if (value >= MiB) return `${Number((value / MiB).toFixed(2))} MiB`;
  return `${value} bytes`;
}
var ResourceCapacityError = class extends Error {
  constructor(kind, estimated, budget, where) {
    super(`${where}\uFF1A${kind}\u4F30\u8BA1 ${formatCapacityBytes(estimated)}\uFF0C\u8D85\u8FC7\u5F53\u524D\u9884\u7B97 ${formatCapacityBytes(budget)}\u3002\u6B64\u4F30\u8BA1\u542B\u89E3\u7801\u6570\u636E\uFF0C\u4E0D\u80FD\u6309 ZIP \u5927\u5C0F\u5224\u65AD\uFF1B\u8BF7\u91CA\u653E\u5185\u5B58\u3001\u8C03\u6574\u5BB9\u91CF\u8BBE\u7F6E\u6216\u5206\u5305\u5BFC\u51FA\u3002`);
    this.name = "ResourceCapacityError";
  }
};

// src/import/zip.ts
var decoder = new TextDecoder("utf-8", { fatal: true });
var crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let i = 0; i < 8; i++) value = value & 1 ? 3988292384 ^ value >>> 1 : value >>> 1;
  return value >>> 0;
});
function fail(message) {
  throw new Error(message);
}
function checksum(bytes) {
  let value = 4294967295;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ value >>> 8;
  return (value ^ 4294967295) >>> 0;
}
function decodeZipName(bytes, flags, extra = new Uint8Array()) {
  if (flags & 2048) {
    try {
      return decoder.decode(bytes);
    } catch {
      fail("ZIP \u6587\u4EF6\u540D\u7684 UTF-8 \u7F16\u7801\u635F\u574F\u3002");
    }
  }
  const fields = new DataView(extra.buffer, extra.byteOffset, extra.byteLength);
  for (let at = 0; at + 4 <= extra.length; ) {
    const size = fields.getUint16(at + 2, true);
    const next = at + 4 + size;
    if (next > extra.length) fail("ZIP \u6587\u4EF6\u540D\u6269\u5C55\u8BB0\u5F55\u8D8A\u754C\u3002");
    if (fields.getUint16(at, true) === 28789 && size >= 5 && extra[at + 4] === 1 && fields.getUint32(at + 5, true) === checksum(bytes)) {
      try {
        return decoder.decode(extra.subarray(at + 9, next));
      } catch {
      }
    }
    at = next;
  }
  try {
    return decoder.decode(bytes);
  } catch {
  }
  try {
    return new TextDecoder("gb18030", { fatal: true }).decode(bytes);
  } catch {
  }
  const cp437 = "\xC7\xFC\xE9\xE2\xE4\xE0\xE5\xE7\xEA\xEB\xE8\xEF\xEE\xEC\xC4\xC5\xC9\xE6\xC6\xF4\xF6\xF2\xFB\xF9\xFF\xD6\xDC\xA2\xA3\xA5\u20A7\u0192\xE1\xED\xF3\xFA\xF1\xD1\xAA\xBA\xBF\u2310\xAC\xBD\xBC\xA1\xAB\xBB\u2591\u2592\u2593\u2502\u2524\u2561\u2562\u2556\u2555\u2563\u2551\u2557\u255D\u255C\u255B\u2510\u2514\u2534\u252C\u251C\u2500\u253C\u255E\u255F\u255A\u2554\u2569\u2566\u2560\u2550\u256C\u2567\u2568\u2564\u2565\u2559\u2558\u2552\u2553\u256B\u256A\u2518\u250C\u2588\u2584\u258C\u2590\u2580\u03B1\xDF\u0393\u03C0\u03A3\u03C3\xB5\u03C4\u03A6\u0398\u03A9\u03B4\u221E\u03C6\u03B5\u2229\u2261\xB1\u2265\u2264\u2320\u2321\xF7\u2248\xB0\u2219\xB7\u221A\u207F\xB2\u25A0\xA0";
  return Array.from(bytes, (byte) => byte < 128 ? String.fromCharCode(byte) : cp437[byte - 128]).join("");
}
function u64(view, offset) {
  if (offset + 8 > view.byteLength) fail("ZIP64 \u6269\u5C55\u8BB0\u5F55\u4E0D\u5B8C\u6574\u3002");
  const value = Number(view.getBigUint64(offset, true));
  if (!Number.isSafeInteger(value)) fail("ZIP64 \u6570\u503C\u8D85\u51FA\u652F\u6301\u8303\u56F4\u3002");
  return value;
}
var ModelArchive = class {
  size;
  entries = [];
  directoryOffset = 0;
  source;
  limits;
  timings;
  constructor(source, limits, timings) {
    this.source = source;
    this.limits = limits;
    this.timings = timings;
    this.size = source instanceof Uint8Array ? source.byteLength : source.size;
    if (!Number.isSafeInteger(this.size) || this.size < 0) fail("ZIP \u6587\u4EF6\u5927\u5C0F\u4E0D\u662F\u6709\u6548\u7684\u5B89\u5168\u6574\u6570\u3002");
    for (const key of ["compressedBytes", "uncompressedBytes", "entryBytes", "entries"]) {
      if (!Number.isSafeInteger(limits[key]) || limits[key] < 0) fail(`ZIP \u5BB9\u91CF\u9650\u5236 ${key} \u65E0\u6548\u3002`);
    }
    for (const key of ["memoryBytes", "heapBytes"]) if (limits[key] !== void 0 && (!Number.isSafeInteger(limits[key]) || limits[key] < 0)) fail(`ZIP \u5BB9\u91CF\u9650\u5236 ${key} \u65E0\u6548\u3002`);
  }
  async read(offset, length) {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || !Number.isSafeInteger(offset + length) || offset + length > this.size || length > 128 * 1024 * 1024) fail("ZIP \u6587\u4EF6\u8BB0\u5F55\u8D8A\u754C\u3002");
    const started = this.timings?.now();
    const result = this.source instanceof Uint8Array ? this.source.subarray(offset, offset + length) : new Uint8Array(await this.source.slice(offset, offset + length).arrayBuffer());
    if (started !== void 0) {
      this.timings.operation("archiveRead", this.timings.now() - started);
      this.timings.count("archiveReadCalls");
      this.timings.count("archiveReadBytes", result.byteLength);
    }
    if (result.byteLength !== length) fail("ZIP \u5206\u6BB5\u8BFB\u53D6\u4E0D\u5B8C\u6574\u3002");
    return result;
  }
  async inspect() {
    if (this.size > this.limits.compressedBytes) fail(`\u6A21\u578B\u8D85\u8FC7\u5F53\u524D\u5141\u8BB8\u7684\u538B\u7F29\u6587\u4EF6\u5927\u5C0F\uFF08${formatCapacityBytes(this.limits.compressedBytes)}\uFF09\u3002`);
    if (this.size < 22) fail("\u6587\u4EF6\u4E0D\u662F\u6709\u6548\u7684 ZIP \u6A21\u578B\u5305\u3002");
    const tailStart = Math.max(0, this.size - 65557);
    const tail = await this.read(tailStart, this.size - tailStart);
    const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
    let end = -1;
    for (let at2 = tail.length - 22; at2 >= 0; at2--) {
      if (view.getUint32(at2, true) === 101010256 && at2 + 22 + view.getUint16(at2 + 20, true) === tail.length) {
        end = at2;
        break;
      }
    }
    if (end < 0) fail("ZIP \u76EE\u5F55\u635F\u574F\uFF0C\u6216\u4F7F\u7528\u4E86\u4E0D\u652F\u6301\u7684\u5206\u5377\u683C\u5F0F\u3002");
    let count = view.getUint16(end + 10, true);
    let directorySize = view.getUint32(end + 12, true);
    let directoryOffset = view.getUint32(end + 16, true);
    if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || view.getUint16(end + 8, true) !== count) fail("\u6682\u4E0D\u652F\u6301\u5206\u5377 ZIP\u3002");
    let directoryEnd = tailStart + end;
    if (count === 65535 || directorySize === 4294967295 || directoryOffset === 4294967295) {
      const locator = await this.read(directoryEnd - 20, 20);
      const lv = new DataView(locator.buffer, locator.byteOffset, locator.length);
      if (lv.getUint32(0, true) !== 117853008 || lv.getUint32(4, true) !== 0 || lv.getUint32(16, true) !== 1) fail("ZIP64 \u5B9A\u4F4D\u8BB0\u5F55\u65E0\u6548\u3002");
      const locatorOffset = directoryEnd - 20;
      directoryEnd = u64(lv, 8);
      const record = await this.read(directoryEnd, 56);
      const rv = new DataView(record.buffer, record.byteOffset, record.length);
      if (rv.getUint32(0, true) !== 101075792 || u64(rv, 4) < 44 || !Number.isSafeInteger(directoryEnd + 12 + u64(rv, 4)) || directoryEnd + 12 + u64(rv, 4) !== locatorOffset || rv.getUint32(16, true) || rv.getUint32(20, true) || u64(rv, 24) !== u64(rv, 32)) fail("ZIP64 \u4E2D\u592E\u76EE\u5F55\u8BB0\u5F55\u65E0\u6548\u3002");
      count = u64(rv, 32);
      directorySize = u64(rv, 40);
      directoryOffset = u64(rv, 48);
    }
    if (!count || count > this.limits.entries) fail(`ZIP \u6587\u4EF6\u6570\u91CF\u8D85\u8FC7\u5F53\u524D\u9650\u5236 ${this.limits.entries}\uFF0C\u6216\u5305\u5185\u6CA1\u6709\u6587\u4EF6\u3002`);
    if (directorySize > 128 * 1024 * 1024 || !Number.isSafeInteger(directoryOffset + directorySize) || directoryOffset + directorySize !== directoryEnd) fail("ZIP \u4E2D\u592E\u76EE\u5F55\u8303\u56F4\u65E0\u6548\u3002");
    const directoryEstimate = directorySize * 3 + count * 256;
    if (this.limits.memoryBytes !== void 0 && directoryEstimate > this.limits.memoryBytes) throw new ResourceCapacityError("\u5DE5\u4F5C\u96C6\u5185\u5B58", directoryEstimate, this.limits.memoryBytes, "ZIP \u4E2D\u592E\u76EE\u5F55\u9884\u68C0");
    if (this.limits.heapBytes !== void 0 && directoryEstimate > this.limits.heapBytes) throw new ResourceCapacityError("\u5BF9\u8C61\u4E0E\u5B57\u7B26\u4E32\u5185\u5B58", directoryEstimate, this.limits.heapBytes, "ZIP \u4E2D\u592E\u76EE\u5F55\u9884\u68C0");
    this.directoryOffset = directoryOffset;
    const directory = await this.read(directoryOffset, directorySize);
    const dv = new DataView(directory.buffer, directory.byteOffset, directory.length);
    const names = /* @__PURE__ */ new Set();
    const entries = [];
    let at = 0;
    let total = 0;
    for (let i = 0; i < count; i++) {
      if (at + 46 > directorySize || dv.getUint32(at, true) !== 33639248) fail("ZIP \u4E2D\u592E\u76EE\u5F55\u635F\u574F\u3002");
      const flags = dv.getUint16(at + 8, true);
      const compression = dv.getUint16(at + 10, true);
      let compressedSize = dv.getUint32(at + 20, true);
      let originalSize = dv.getUint32(at + 24, true);
      let offset = dv.getUint32(at + 42, true);
      const nameSize = dv.getUint16(at + 28, true);
      const extraSize = dv.getUint16(at + 30, true);
      const next = at + 46 + nameSize + extraSize + dv.getUint16(at + 32, true);
      if (next > directorySize) fail("ZIP \u6587\u4EF6\u540D\u6216\u6269\u5C55\u533A\u8D8A\u754C\u3002");
      if (flags & 1) fail("\u6682\u4E0D\u652F\u6301\u52A0\u5BC6 ZIP\u3002");
      if (compression !== 0 && compression !== 8) fail("ZIP \u4F7F\u7528\u4E86\u4E0D\u652F\u6301\u7684\u538B\u7F29\u65B9\u6CD5\u3002");
      if (dv.getUint16(at + 34, true)) fail("\u6682\u4E0D\u652F\u6301\u5206\u5377 ZIP\u3002");
      if ([compressedSize, originalSize, offset].includes(4294967295)) {
        let extra = at + 46 + nameSize;
        const extraEnd = extra + extraSize;
        let found = false;
        while (extra + 4 <= extraEnd) {
          const length = dv.getUint16(extra + 2, true);
          const stop = extra + 4 + length;
          if (stop > extraEnd) fail("ZIP64 \u6269\u5C55\u8BB0\u5F55\u8D8A\u754C\u3002");
          if (dv.getUint16(extra, true) === 1) {
            const zv = new DataView(directory.buffer, directory.byteOffset + extra + 4, length);
            let p = 0;
            if (originalSize === 4294967295) {
              originalSize = u64(zv, p);
              p += 8;
            }
            if (compressedSize === 4294967295) {
              compressedSize = u64(zv, p);
              p += 8;
            }
            if (offset === 4294967295) offset = u64(zv, p);
            found = true;
            break;
          }
          extra = stop;
        }
        if (!found) fail("\u7F3A\u5C11 ZIP64 \u6587\u4EF6\u5927\u5C0F\u8BB0\u5F55\u3002");
      }
      const nameBytes = directory.slice(at + 46, at + 46 + nameSize);
      const originalName = decodeZipName(nameBytes, flags, directory.subarray(at + 46 + nameSize, at + 46 + nameSize + extraSize));
      const name = originalName.replaceAll("\\", "/");
      if (!name || name.startsWith("/") || /[\u0000-\u001f:]/u.test(name) || name.split("/").some((p) => [".", "..", "__proto__", "constructor", "prototype"].includes(p))) fail("ZIP \u5305\u542B\u4E0D\u5B89\u5168\u7684\u6587\u4EF6\u8DEF\u5F84\u3002");
      const canonical = name.toLowerCase();
      if (names.has(canonical)) fail("ZIP \u4E2D\u5B58\u5728\u91CD\u590D\u6587\u4EF6\u540D\u3002");
      names.add(canonical);
      if (originalSize > this.limits.entryBytes) fail(`ZIP \u4E2D\u5355\u4E2A\u6587\u4EF6\u8D85\u8FC7\u5F53\u524D\u89E3\u538B\u5927\u5C0F\u9650\u5236\uFF08${formatCapacityBytes(this.limits.entryBytes)}\uFF09\u3002`);
      total += originalSize;
      if (!Number.isSafeInteger(total) || total > this.limits.uncompressedBytes) fail(`ZIP \u89E3\u538B\u540E\u7684\u603B\u5927\u5C0F\u8D85\u8FC7\u5F53\u524D\u9650\u5236\uFF08${formatCapacityBytes(this.limits.uncompressedBytes)}\uFF09\u3002`);
      if (!Number.isSafeInteger(offset + 30 + compressedSize) || offset + 30 + compressedSize > directoryOffset) fail("ZIP \u672C\u5730\u6587\u4EF6\u8BB0\u5F55\u8D8A\u754C\u3002");
      entries.push({ name, originalName, originalSize, compressedSize, offset, flags, compression, crc: dv.getUint32(at + 16, true), nameBytes });
      at = next;
    }
    if (at !== directorySize) fail("ZIP \u4E2D\u592E\u76EE\u5F55\u5927\u5C0F\u4E0D\u4E00\u81F4\u3002");
    this.entries = entries;
    return entries;
  }
  async *chunks(entry) {
    const header = await this.read(entry.offset, 30);
    const hv = new DataView(header.buffer, header.byteOffset, header.length);
    if (hv.getUint32(0, true) !== 67324752 || hv.getUint16(6, true) !== entry.flags || hv.getUint16(8, true) !== entry.compression) fail("ZIP \u672C\u5730\u6587\u4EF6\u5934\u4E0E\u4E2D\u592E\u76EE\u5F55\u4E0D\u4E00\u81F4\u3002");
    const nameSize = hv.getUint16(26, true);
    const localName = await this.read(entry.offset + 30, nameSize);
    if (localName.length !== entry.nameBytes.length || localName.some((b, i) => b !== entry.nameBytes[i])) fail("ZIP \u6587\u4EF6\u540D\u8BB0\u5F55\u4E0D\u4E00\u81F4\u3002");
    if (!(entry.flags & 8) && (hv.getUint32(14, true) !== entry.crc || hv.getUint32(18, true) !== 4294967295 && hv.getUint32(18, true) !== entry.compressedSize || hv.getUint32(22, true) !== 4294967295 && hv.getUint32(22, true) !== entry.originalSize)) fail("ZIP \u672C\u5730\u6587\u4EF6\u6821\u9A8C\u8BB0\u5F55\u4E0E\u4E2D\u592E\u76EE\u5F55\u4E0D\u4E00\u81F4\u3002");
    const start = entry.offset + 30 + nameSize + hv.getUint16(28, true);
    if (!Number.isSafeInteger(start + entry.compressedSize) || start + entry.compressedSize > this.directoryOffset) fail("ZIP \u6570\u636E\u8303\u56F4\u65E0\u6548\u3002");
    let crc = 4294967295;
    let size = 0;
    let output = [];
    const accept = (data) => {
      size += data.length;
      if (size > entry.originalSize || size > this.limits.entryBytes) fail("ZIP \u5B9E\u9645\u89E3\u538B\u5927\u5C0F\u8D85\u8FC7\u6587\u4EF6\u76EE\u5F55\u3002");
      const started = this.timings?.now();
      for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]) & 255] ^ crc >>> 8;
      if (started !== void 0) {
        this.timings.operation("archiveCrc", this.timings.now() - started);
        this.timings.count("archiveDecodedBytes", data.length);
      }
      output.push(data);
    };
    const inflater = entry.compression === 8 ? new Inflate((data) => accept(data)) : null;
    const step = 1024 * 1024;
    for (let offset = 0; offset < entry.compressedSize; offset += step) {
      const data = await this.read(start + offset, Math.min(step, entry.compressedSize - offset));
      if (inflater) {
        for (let part = 0; part < data.length; part += 16 * 1024) {
          const piece = data.subarray(part, Math.min(part + 16 * 1024, data.length));
          const started = this.timings?.now(), crcBefore = this.timings?.operationTotal("archiveCrc");
          inflater.push(piece, offset + part + piece.length === entry.compressedSize);
          if (started !== void 0) this.timings.operation(
            "archiveInflate",
            this.timings.now() - started - (this.timings.operationTotal("archiveCrc") - crcBefore)
          );
          for (const chunk of output) yield chunk;
          output = [];
        }
      } else {
        accept(data);
        for (const chunk of output) yield chunk;
        output = [];
      }
    }
    if (entry.compressedSize === 0 && inflater) inflater.push(new Uint8Array(), true);
    for (const chunk of output) yield chunk;
    if (size !== entry.originalSize) fail("ZIP \u5B9E\u9645\u89E3\u538B\u5927\u5C0F\u4E0E\u6587\u4EF6\u76EE\u5F55\u4E0D\u4E00\u81F4\u3002");
    if ((crc ^ 4294967295) >>> 0 !== entry.crc) fail("ZIP \u6587\u4EF6\u6821\u9A8C\u5931\u8D25\uFF0C\u6A21\u578B\u5305\u53EF\u80FD\u635F\u574F\u3002");
  }
};

// src/import/json-stream.ts
async function* jsonRecords(chunks, array, where, limits = {}) {
  const maxRecordCharacters = limits.maxRecordCharacters ?? 64 * 1024 * 1024;
  const maxDepth = limits.maxDepth ?? 32;
  if (!Number.isSafeInteger(maxRecordCharacters) || maxRecordCharacters < 1 || maxRecordCharacters > 64 * 1024 * 1024 || !Number.isSafeInteger(maxDepth) || maxDepth < 1 || maxDepth > 32) throw new Error("JSON \u8BB0\u5F55\u9650\u5236\u65E0\u6548\u3002");
  const decoder2 = new TextDecoder("utf-8", { fatal: true });
  let started = false;
  let ended = false;
  let quoted = false;
  let escaped = false;
  let depth = 0;
  let record = "";
  let index = 0;
  let afterComma = false;
  let activeStarted;
  const pauseTiming = () => {
    if (activeStarted !== void 0) limits.timings.operation("jsonRecordProcessing", limits.timings.now() - activeStarted);
    activeStarted = void 0;
  };
  const close = array ? "]" : "}";
  function append(piece) {
    if (record.length + piece.length > maxRecordCharacters) throw new Error(`${where} JSON \u5355\u6761\u8BB0\u5F55\u8D85\u8FC7 ${maxRecordCharacters} \u5B57\u7B26\u9650\u5236\uFF0C\u8BF7\u7EC6\u5206\u8BE5\u6784\u4EF6\u51E0\u4F55\u3002`);
    record += piece;
  }
  function parse() {
    const text = record.trim();
    record = "";
    if (!text) throw new Error(`${where} \u4E0D\u662F\u6709\u6548\u7684 UTF-8 JSON\u3002`);
    limits.beforeParse?.(text.length);
    limits.timings?.count("jsonRecords");
    if (array) return [String(index++), JSON.parse(text)];
    const row2 = JSON.parse(`{${text}}`);
    const keys = Object.keys(row2);
    if (keys.length !== 1) throw new Error(`${where} \u5305\u542B\u65E0\u6548\u8BB0\u5F55\u3002`);
    return [keys[0], row2[keys[0]]];
  }
  try {
    for await (const bytes of chunks) {
      activeStarted = limits.timings?.now();
      limits.timings?.count("jsonBytes", bytes.length);
      const text = decoder2.decode(bytes, { stream: true });
      let pieceStart = 0;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (!started) {
          pieceStart = i + 1;
          if (/\s|\uFEFF/u.test(c)) continue;
          if (c !== (array ? "[" : "{")) throw new Error();
          started = true;
          continue;
        }
        if (ended) {
          pieceStart = i + 1;
          if (!/\s/u.test(c)) throw new Error();
          continue;
        }
        if (quoted) {
          if (escaped) escaped = false;
          else if (c === "\\") escaped = true;
          else if (c === '"') quoted = false;
          continue;
        }
        if (c === '"') quoted = true;
        else if ((c === "," || c === close) && depth === 0) {
          append(text.slice(pieceStart, i));
          pieceStart = i + 1;
          if (record.trim()) {
            const parsed = parse();
            pauseTiming();
            yield parsed;
            activeStarted = limits.timings?.now();
            afterComma = c === ",";
          } else if (c === "," || afterComma) throw new Error();
          if (c === close) ended = true;
        } else if (c === "[" || c === "{") {
          if (++depth > maxDepth) throw new Error(`${where} JSON \u5D4C\u5957\u8D85\u8FC7 ${maxDepth} \u5C42\u9650\u5236\u3002`);
        } else if (c === "]" || c === "}") {
          depth--;
          if (depth < 0) throw new Error();
        }
      }
      if (started && !ended) append(text.slice(pieceStart));
      pauseTiming();
    }
    activeStarted = limits.timings?.now();
    decoder2.decode();
    if (!started || !ended || quoted || depth !== 0) throw new Error();
  } catch (error) {
    if (error instanceof Error && (/ZIP|字符限制|层限制/u.test(error.message) || error.name === "ResourceCapacityError")) throw error;
    throw new Error(`${where} \u4E0D\u662F\u6709\u6548\u7684 UTF-8 JSON\u3002`);
  } finally {
    pauseTiming();
  }
}

// src/quantities.ts
var QUANTITY_KEYS = ["length", "area", "volume"];
var QUANTITY_DEFINITIONS = Object.freeze({
  length: { unit: "m", parameter: "CURVE_ELEM_LENGTH" },
  area: { unit: "m2", parameter: "HOST_AREA_COMPUTED" },
  volume: { unit: "m3", parameter: "HOST_VOLUME_COMPUTED" }
});
var object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var identityText = (value, empty = false) => typeof value === "string" && value.length <= 1024 && (empty && value === "" || value.trim().length > 0) && !/[\u0000-\u001f\u007f]/u.test(value);
function metricStatus(key, status, issue) {
  return { ...QUANTITY_DEFINITIONS[key], status, value: null, ...issue ? { issue } : {} };
}
function parseQuantitySnapshot(raw) {
  if (raw === void 0) return {};
  if (!object(raw)) return { issue: "invalid-snapshot" };
  if (raw.schemaVersion !== 1) return { issue: "unsupported-version" };
  if (raw.source !== "revit-parameters") return { issue: "invalid-source" };
  const source = raw.sourceElement;
  if (!object(source) || !identityText(source.uniqueId) || !identityText(source.elementId) || !identityText(source.documentScope) || !identityText(source.linkInstanceScope, true)) return { issue: "invalid-source-element" };
  if (!object(raw.metrics)) return { issue: "invalid-metrics" };
  const metrics = {};
  let invalid = false;
  for (const key of QUANTITY_KEYS) {
    const value = raw.metrics[key];
    const expected = QUANTITY_DEFINITIONS[key];
    if (!object(value) || value.unit !== expected.unit || value.parameter !== expected.parameter) {
      metrics[key] = metricStatus(key, "invalid", "invalid-metric-definition");
      invalid = true;
      continue;
    }
    if (value.status === "available") {
      if (typeof value.value === "number" && Number.isFinite(value.value) && value.value >= 0) {
        metrics[key] = { ...expected, status: "available", value: value.value };
      } else {
        metrics[key] = metricStatus(key, "invalid", "invalid-number");
        invalid = true;
      }
    } else if ((value.status === "missing" || value.status === "invalid" || value.status === "unavailable") && value.value === null) {
      metrics[key] = metricStatus(key, value.status);
    } else {
      metrics[key] = metricStatus(key, "invalid", "invalid-status-value");
      invalid = true;
    }
  }
  return {
    snapshot: {
      schemaVersion: 1,
      source: "revit-parameters",
      sourceElement: { uniqueId: source.uniqueId, elementId: source.elementId, documentScope: source.documentScope, linkInstanceScope: source.linkInstanceScope },
      metrics
    },
    ...invalid ? { issue: "invalid-metric" } : {}
  };
}
function sourceKey(source) {
  return `source:${JSON.stringify([source.documentScope, source.linkInstanceScope, source.uniqueId, source.elementId])}`;
}
function mergeQuantityObjects(universe) {
  const objects = /* @__PURE__ */ new Map();
  const sceneIds = /* @__PURE__ */ new Set();
  for (const component of universe) {
    if (sceneIds.has(component.id)) continue;
    sceneIds.add(component.id);
    const snapshot = component.quantitySnapshot;
    const key = snapshot ? sourceKey(snapshot.sourceElement) : `record:${JSON.stringify(component.id)}`;
    const metrics = snapshot?.metrics ?? Object.fromEntries(QUANTITY_KEYS.map((metric) => [metric, metricStatus(metric, component.quantityIssue ? "invalid" : "missing")]));
    const existing = objects.get(key);
    if (existing) {
      existing.componentIds.push(component.id);
      existing.categories.add(component.category);
      for (const level of component.levelNames) if (level) existing.levels.add(level);
      for (const metric of QUANTITY_KEYS) {
        const left = existing.metrics[metric];
        const right = metrics[metric];
        if (left.issue === "conflicting-source") continue;
        if (left.status !== right.status || left.value !== right.value || left.unit !== right.unit || left.parameter !== right.parameter) {
          existing.metrics[metric] = metricStatus(metric, "invalid", "conflicting-source");
        }
      }
    } else {
      objects.set(key, {
        ordinal: objects.size,
        key,
        label: component.name || component.id,
        componentIds: [component.id],
        categories: /* @__PURE__ */ new Set([component.category]),
        levels: new Set(component.levelNames.filter(Boolean)),
        source: snapshot ? { ...snapshot.sourceElement } : void 0,
        metrics: Object.fromEntries(QUANTITY_KEYS.map((metric) => [metric, { ...metrics[metric] }]))
      });
    }
  }
  return [...objects.values()];
}
function labels(language) {
  return language === "en" ? { mixedCategory: "Conflicting categories", noCategory: "Unclassified", multiLevel: "Multiple levels (not split)", noLevel: "Unassigned level", total: "Total" } : { mixedCategory: "\u7C7B\u522B\u4E0D\u4E00\u81F4", noCategory: "\u672A\u5206\u7C7B", multiLevel: "\u591A\u697C\u5C42\uFF08\u672A\u62C6\u5206\uFF09", noLevel: "\u672A\u6307\u5B9A\u697C\u5C42", total: "\u5408\u8BA1" };
}
function categoryOf(item, language) {
  return item.categories.size > 1 ? labels(language).mixedCategory : [...item.categories][0] || labels(language).noCategory;
}
function levelOf(item, language) {
  return item.levels.size > 1 ? labels(language).multiLevel : [...item.levels][0] || labels(language).noLevel;
}
function summarizeMetricValues(items, get) {
  const result = { value: null, available: 0, missing: 0, invalid: 0, unavailable: 0, overflow: false };
  let sum = 0;
  let correction = 0;
  for (const item of items) {
    const metric = get(item);
    result[metric.status]++;
    if (metric.status !== "available") continue;
    const value = metric.value;
    const next = sum + value;
    if (!Number.isFinite(next)) {
      result.overflow = true;
      continue;
    }
    correction += Math.abs(sum) >= Math.abs(value) ? sum - next + value : value - next + sum;
    sum = next;
  }
  const total = sum + correction;
  if (!Number.isFinite(total)) result.overflow = true;
  if (result.available && !result.overflow) result.value = total;
  return result;
}
function totals(objects) {
  return Object.fromEntries(QUANTITY_KEYS.map((key) => [key, summarizeMetricValues(objects, (object2) => object2.metrics[key])]));
}
function row(key, label, objects, category, level) {
  const componentIds = objects.flatMap((object2) => object2.componentIds);
  return {
    key,
    label,
    componentIds,
    count: objects.length,
    recordCount: componentIds.length,
    duplicateSources: componentIds.length - objects.length,
    category,
    level,
    sources: objects.flatMap((object2) => object2.source ? [{ ...object2.source }] : []),
    metrics: totals(objects)
  };
}
function rowsForObjects(objects, mode, language) {
  if (mode === "component") return objects.map((object2) => row(object2.key, object2.label, [object2], categoryOf(object2, language), levelOf(object2, language)));
  const groups = /* @__PURE__ */ new Map();
  for (const object2 of objects) {
    const label = mode === "category" ? categoryOf(object2, language) : levelOf(object2, language);
    const values = mode === "category" ? object2.categories : object2.levels;
    const key = values.size > 1 ? `${mode}:multiple` : values.size === 0 || [...values][0] === "" ? `${mode}:unassigned` : `${mode}:${JSON.stringify([...values][0])}`;
    const group = groups.get(key);
    if (group) group.objects.push(object2);
    else groups.set(key, { label, objects: [object2] });
  }
  return [...groups].map(([key, group]) => row(key, group.label, group.objects, mode === "category" ? group.label : "", mode === "level" ? group.label : ""));
}
function createQuantityIndex(universe) {
  const objects = mergeQuantityObjects(universe);
  const bySceneId = /* @__PURE__ */ new Map();
  for (const object2 of objects) for (const id of object2.componentIds) bySceneId.set(id, object2);
  const select = (scope) => {
    const selected = /* @__PURE__ */ new Set();
    for (const component of scope) {
      const object2 = bySceneId.get(component.id);
      if (object2) selected.add(object2);
    }
    if (selected.size === objects.length) return objects;
    return [...selected].sort((left, right) => left.ordinal - right.ordinal);
  };
  return {
    buildRows: (scope, mode, language = "zh") => rowsForObjects(select(scope), mode, language),
    summarize: (scope, language = "zh") => row("total", labels(language).total, select(scope), "", ""),
    aggregate(scope) {
      const items = select(scope);
      return { count: items.length, identifiedObjects: items.reduce((n, item) => n + Number(!!item.source), 0), metrics: totals(items) };
    }
  };
}

// src/project-qa-model.ts
var labels2 = { length: "\u957F\u5EA6", area: "\u9762\u79EF", volume: "\u4F53\u79EF" };
var displayUnits = { m: "m", m2: "m\xB2", m3: "m\xB3" };
var wallCategories = /* @__PURE__ */ new Set(["\u5899", "\u5899\u4F53", "wall", "walls", "ifcwall", "ifcwallstandardcase", "ifcwallelementedcase"]);
var wallUnion = "\u5899\u4F53\uFF08\u5168\u90E8\u5899\u7C7B\uFF09";
var tooLarge = "\u6A21\u578B\u7EDF\u8BA1\u8D44\u6599\u8D85\u8FC7\u53EF\u5F15\u7528\u8303\u56F4\uFF0C\u8BF7\u5728\u6E90\u6A21\u578B\u4E2D\u7F29\u5C0F\u5BFC\u51FA\u8303\u56F4\u540E\u91CD\u8BD5\u3002";
var hasUnsafeLabel = (value) => /[\u0000-\u001f\u007f]/u.test(value);
function namedTotals(records) {
  const fields = /* @__PURE__ */ new Map();
  for (const record of records) {
    for (const item of record.ifcQuantities ?? []) {
      const key = JSON.stringify([item.group, item.name, item.metric]);
      let field = fields.get(key);
      if (!field) {
        if (fields.size >= 64) throw new Error(tooLarge);
        field = { quantity: item, values: /* @__PURE__ */ new Map() };
        fields.set(key, field);
      }
      const prior = field.values.get(record.id);
      if (prior && (prior.value !== item.value || prior.status !== item.status)) {
        field.values.set(record.id, { ...item, value: null, status: "invalid" });
      } else if (!prior) field.values.set(record.id, item);
    }
  }
  return [...fields.values()].map(({ quantity: { name, group, metric }, values }) => {
    const sum = summarizeMetricValues([...values.values()], (item) => item);
    sum.missing += records.length - values.size;
    return { name, group, metric, unit: QUANTITY_DEFINITIONS[metric].unit, ...sum };
  });
}
function metricText(label, total) {
  const unit = displayUnits[total.unit];
  const amount = total.overflow ? "\u5408\u8BA1\u6EA2\u51FA" : total.value === null ? "\u65E0\u53EF\u7528\u5408\u8BA1" : "\u6709\u6548\u5408\u8BA1 " + total.value + " " + unit;
  return label + "\uFF08" + unit + "\uFF09" + amount + "\uFF0C\u6709\u6548 " + total.available + "\u3001\u7F3A\u5931 " + total.missing + "\u3001\u65E0\u6548 " + total.invalid + "\u3001\u8BFB\u53D6\u6216\u5355\u4F4D\u4E0D\u53EF\u7528 " + total.unavailable;
}
async function buildModelQaDocument(model, options = {}) {
  const signal = options.signal;
  signal?.throwIfAborted();
  const name = model.name.split(/[\\/]/u).at(-1)?.trim().replace(/[\u0000-\u001f\u007f]/gu, " ") || "\u672A\u547D\u540D\u6A21\u578B";
  const result = { kind: "model", title: name.slice(0, 180) + " \xB7 \u6A21\u578B\u7EDF\u8BA1", passages: [] };
  const all = { category: null, level: null, records: [] };
  const groups = /* @__PURE__ */ new Map();
  const ids = /* @__PURE__ */ new Set();
  let textLength = 0;
  let yieldedAt = Date.now();
  const yieldIfBusy = async () => {
    if (Date.now() - yieldedAt >= 20) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      signal?.throwIfAborted();
      yieldedAt = Date.now();
    }
  };
  const add = (item, category, level, union = false) => {
    const key = JSON.stringify([category, level, union]);
    let group = groups.get(key);
    if (!group) {
      if (groups.size >= 6e3) throw new Error(tooLarge);
      group = { category, level, records: [], ...union ? { unionCategories: /* @__PURE__ */ new Set() } : {} };
      groups.set(key, group);
    }
    group.records.push(item);
    group.unionCategories?.add(item.category);
  };
  for (const component of model.components) {
    if (ids.has(component.id)) continue;
    ids.add(component.id);
    all.records.push(component);
    const category = component.category || "";
    const levels = new Set(component.levelNames.filter(Boolean));
    if (!levels.size) levels.add("");
    if (hasUnsafeLabel(category) || [...levels].some(hasUnsafeLabel)) throw new Error("\u6A21\u578B\u7684\u7C7B\u522B\u6216\u697C\u5C42\u540D\u79F0\u542B\u6709\u65E0\u6CD5\u5F15\u7528\u7684\u63A7\u5236\u5B57\u7B26\u3002");
    add(component, category, null);
    const wall = wallCategories.has(category.trim().toLowerCase());
    if (wall) add(component, wallUnion, null, true);
    for (const level of levels) {
      add(component, null, level);
      add(component, category, level);
      if (wall) add(component, wallUnion, level, true);
    }
    if (ids.size % 512 === 0) await yieldIfBusy();
  }
  const indexed = createQuantityIndex(all.records);
  const ifc = model.source?.format === "IFC";
  const source = ifc ? "ifc" : all.records.some((record) => record.quantitySnapshot) ? "revit-parameters" : "model-records";
  const provenance = ifc ? "IFC \u5B9E\u4F8B\u8BB0\u5F55\u4E0E\u6587\u4EF6\u58F0\u660E\u7684\u547D\u540D\u5DE5\u7A0B\u91CF" : source === "revit-parameters" ? "BV \u6A21\u578B\u4E2D\u5BFC\u51FA\u7684 Revit \u5B9E\u4F8B\u539F\u59CB\u53C2\u6570" : "\u6A21\u578B\u6784\u4EF6\u8BB0\u5F55\uFF0C\u672A\u63D0\u4F9B\u53EF\u6838\u9A8C\u7684 Revit \u5B9E\u4F8B\u539F\u59CB\u91CF\u5FEB\u7167";
  for (const group of [all, ...groups.values()]) {
    await yieldIfBusy();
    const { category, level, records } = group;
    if (group.unionCategories && group.unionCategories.size < 2) continue;
    if (group.unionCategories && groups.has(JSON.stringify([wallUnion, level, false]))) throw new Error("\u6A21\u578B\u5B9E\u9645\u7C7B\u522B\u4E0E\u5899\u7C7B\u5408\u8BA1\u540D\u79F0\u76F8\u540C\uFF0C\u65E0\u6CD5\u533A\u5206\uFF0C\u8BF7\u8C03\u6574\u6E90\u5206\u7C7B\u3002");
    const scope = category === null ? level === null ? "model" : "level" : level === null ? "category" : "level-category";
    const location = [level !== null && "\u697C\u5C42\u300C" + (level || "\u672A\u6307\u5B9A\u697C\u5C42") + "\u300D", category !== null && "\u7C7B\u522B\u300C" + (category || "\u672A\u5206\u7C7B") + "\u300D"].filter(Boolean).join(" \xB7 ") || "\u5168\u6A21\u578B";
    if (location.length > 220) throw new Error("\u697C\u5C42\u6216\u7C7B\u522B\u540D\u79F0\u8FC7\u957F\uFF0C\u65E0\u6CD5\u4FDD\u7559\u5B8C\u6574\u6A21\u578B\u51FA\u5904\u3002");
    const totals2 = indexed.aggregate(records);
    const metrics = Object.fromEntries(QUANTITY_KEYS.map((key) => [key, { unit: QUANTITY_DEFINITIONS[key].unit, ...totals2.metrics[key] }]));
    const fact = {
      scope,
      category,
      level,
      source,
      components: records.length,
      objects: totals2.count,
      identifiedObjects: ifc ? records.length : totals2.identifiedObjects,
      metrics
    };
    const definitions = ifc ? namedTotals(records) : [];
    if (definitions.length) fact.ifcQuantities = definitions;
    const base = "\u6A21\u578B\u300C" + result.title.slice(0, -" \xB7 \u6A21\u578B\u7EDF\u8BA1".length) + "\u300D\uFF0C" + location + "\u3002\u6765\u6E90\u4E3A" + provenance + "\u3002\u6784\u4EF6\u8BB0\u5F55\u6570 " + fact.components + "\uFF0C\u8BA1\u91CF\u5BF9\u8C61\u6570 " + fact.objects + "\uFF0C\u5176\u4E2D\u6709\u53EF\u8BC6\u522B\u6765\u6E90\u7684\u5BF9\u8C61 " + fact.identifiedObjects + "\u3002" + (ifc ? "\u6309 IFC \u5B9E\u4F8B\u8BA1\u6570\uFF0C\u51C0\u91CF\u548C\u6BDB\u91CF\u5206\u522B\u5217\u793A\u3002" : "\u540C\u4E00\u6765\u6E90\u53CA\u94FE\u63A5\u5B9E\u4F8B\u53BB\u91CD\uFF0C\u7F3A\u5C11\u6765\u6E90\u65F6\u6309\u8BB0\u5F55\u8BA1\u6570\u3002") + "\u8DE8\u697C\u5C42\u5BF9\u8C61\u53D6\u6574\u4F53\u91CF\uFF0C\u5404\u697C\u5C42\u7ED3\u679C\u4E0D\u53EF\u76F8\u52A0\u3002";
    const units = QUANTITY_KEYS.map((key) => metricText(labels2[key], metrics[key])).join("\u3002") + "\u3002";
    const note = source === "revit-parameters" ? "\u53C2\u6570\u5206\u522B\u4E3A CURVE_ELEM_LENGTH\u3001HOST_AREA_COMPUTED\u3001HOST_VOLUME_COMPUTED\u3002\u672A\u505A\u5730\u533A\u89C4\u5219\u6263\u51CF\u3002" : ifc ? "\u901A\u7528\u957F\u5EA6\u3001\u9762\u79EF\u3001\u4F53\u79EF\u65E0\u7EDF\u4E00\u53D6\u503C\u53E3\u5F84\uFF0CIFC \u547D\u540D\u91CF\u6309\u5404\u5B57\u6BB5\u5217\u793A\u3002" : "";
    const passage = { location, text: base + units + note, fact };
    result.passages.push(passage);
    textLength += passage.text.length;
    for (const item of definitions) {
      const text = metricText(item.group + "." + item.name, item) + "\u3002";
      if (hasUnsafeLabel(item.name) || hasUnsafeLabel(item.group) || text.length > 3500 - base.length) throw new Error(tooLarge);
      if (passage.text.length + text.length <= 3500) passage.text += text;
      else {
        result.passages.push({ location, text: base + text });
        textLength += base.length;
      }
      textLength += text.length;
    }
    if (textLength > 12e5 || result.passages.length > 6e3) throw new Error(tooLarge);
  }
  signal?.throwIfAborted();
  return result;
}
export {
  ModelArchive,
  buildModelQaDocument,
  jsonRecords,
  parseQuantitySnapshot
};
