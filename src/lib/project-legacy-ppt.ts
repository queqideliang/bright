import { CFB } from 'xlsx';

interface RecordHeader { type: number; instance: number; start: number; end: number }
type Passage = { location: string; text: string };
const invalid = () => new Error('无法确认旧 PPT 的当前演示内容。请在 PowerPoint 或 WPS 中另存为 .pptx 后添加。');

/** MS-PPT §§2.1.2, 2.3.3, 2.3.4. Only objects reachable from the latest user edit are live. */
export async function readLegacyPresentation(file: File): Promise<Passage[]> {
  if (file.size > 12 * 1024 * 1024) throw new Error('单份演示文稿最大 12 MiB。');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (![0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((value, i) => bytes[i] === value)) throw invalid();
  let compound: unknown;
  try { compound = CFB.read(bytes, { type: 'array' }); } catch { throw invalid(); }
  function stream(path: string): Uint8Array {
    const entry = CFB.find(compound, '/' + path);
    if (!entry || entry.type !== 2 || !entry.content?.length || entry.content.length > bytes.length) throw invalid();
    return Uint8Array.from(entry.content);
  }
  const user = stream('Current User');
  const current = new DataView(user.buffer as ArrayBuffer);
  if (user.length < 28 || current.getUint16(2, true) !== 4086) throw invalid();
  if (current.getUint32(12, true) !== 0xe391c05f) throw new Error('旧 PPT 已加密或格式不受支持，请另存为未加密的 .pptx。');
  const content = stream('PowerPoint Document');
  const data = new DataView(content.buffer as ArrayBuffer);
  const u16 = (at: number) => data.getUint16(at, true);
  const u32 = (at: number) => data.getUint32(at, true);
  let reads = 0;
  function record(at: number, limit = content.length): RecordHeader {
    if (++reads > 250_000 || at + 8 > limit) throw invalid();
    const start = at + 8, end = start + u32(at + 4);
    if (end > limit) throw invalid();
    return { type: u16(at + 2), instance: u16(at) >>> 4, start, end };
  }
  function* children(parent: RecordHeader) {
    let at = parent.start;
    while (at < parent.end) {
      const child = record(at, parent.end);
      yield child;
      at = child.end;
    }
  }
  function word(rec: RecordHeader, offset: number) {
    if (rec.start + offset + 4 > rec.end) throw invalid();
    return u32(rec.start + offset);
  }

  let editOffset = current.getUint32(16, true);
  let documentId = 0;
  const persist = new Map<number, number>();
  while (editOffset) {
    const edit = record(editOffset);
    if (edit.type !== 4085 || ![28, 32].includes(edit.end - edit.start)) throw invalid();
    if (edit.end - edit.start === 32 && word(edit, 28)) throw invalid();
    if (!documentId) documentId = word(edit, 16);
    const previous = word(edit, 8), directory = word(edit, 12);
    if (previous >= directory || directory >= editOffset) throw invalid();
    const block = record(directory, editOffset);
    if (block.type !== 6002) throw invalid();
    for (let at = block.start; at < block.end;) {
      if (at + 4 > block.end) throw invalid();
      const packed = u32(at), first = packed & 0xfffff, count = packed >>> 20;
      at += 4;
      if (!first || !count || at + 4 * count > block.end || first + count > 0x100000) throw invalid();
      for (let i = 0; i < count; i++, at += 4) {
        if (!persist.has(first + i)) persist.set(first + i, u32(at));
        if (persist.size > 150_000) throw invalid();
      }
    }
    editOffset = previous;
  }
  function object(id: number, expected: number) {
    const offset = persist.get(id);
    if (offset === undefined) throw invalid();
    const node = record(offset);
    if (node.type !== expected) throw invalid();
    return node;
  }

  const document = object(documentId, 1000);
  // Instances 1 and 2 reference master slides and speaker notes respectively.
  const slideList = [...children(document)].find(r => r.type === 4080 && r.instance === 0);
  if (!slideList) throw invalid();
  const slides: { persistId: number; outline: (RecordHeader | undefined)[] }[] = [];
  for (const atom of children(slideList)) {
    if (atom.type === 1011) {
      if (slides.length >= 500) throw new Error('请将超过 500 页的演示文稿按章节拆分。');
      slides.push({ persistId: word(atom, 0), outline: [] });
    } else {
      const slide = slides.at(-1);
      if (!slide) continue;
      if (atom.type === 3999) slide.outline.push(undefined);
      if ((atom.type === 4000 || atom.type === 4008) && slide.outline.length) slide.outline[slide.outline.length - 1] = atom;
    }
  }
  const unicode = new TextDecoder('utf-16le', { fatal: true });
  function decode(atom: RecordHeader) {
    const length = atom.end - atom.start;
    if (length > 2_400_000) throw invalid();
    const raw = content.subarray(atom.start, atom.end);
    if (atom.type === 4000) return unicode.decode(raw);
    // TextBytesAtom stores the low byte of each UTF-16 code unit (no code page).
    let text = '';
    for (let at = 0; at < raw.length; at += 8192) text += String.fromCharCode(...raw.subarray(at, at + 8192));
    return text;
  }
  const passages: Passage[] = [];
  let total = 0;
  function add(text: string, location: string) {
    text = text.replace(/[\x00-\x1f]+/g, ' ').trim();
    total += text.length;
    if (total > 1_200_000) throw new Error('演示文稿文字过多，请按章节拆分。');
    for (let i = 0; i < text.length; i += 960) {
      if (passages.length >= 6000) throw invalid();
      passages.push({ location, text: text.slice(i, i + 1080) });
      if (i + 1080 >= text.length) break;
    }
  }
  for (const [i, item] of slides.entries()) {
    const slide = [...children(object(item.persistId, 1006))];
    if (slide.some(atom => {
      if (atom.type !== 1017) return false;
      if (atom.end - atom.start !== 16) throw invalid();
      return !!(u16(atom.start + 10) & 4);
    })) continue;
    let shapeNumber = 0;
    function drawing(parent: RecordHeader, depth: number) {
      if (depth > 48) throw invalid();
      for (const child of children(parent)) {
        if ([0xf002, 0xf003, 0xf004].includes(child.type)) drawing(child, depth + 1);
        // Follow only a shape's client textbox. It contains either an outline reference or live inline text.
        if (parent.type !== 0xf004 || child.type !== 0xf00d) continue;
        shapeNumber++;
        const location = '第 ' + (i + 1) + ' 张幻灯片 · 文本框 ' + shapeNumber;
        for (const atom of children(child)) {
          if (atom.type === 3998) {
            const index = word(atom, 0);
            if (index >= item.outline.length) throw invalid();
            const text = item.outline[index];
            if (text) add(decode(text), location);
          } else if (atom.type === 4000 || atom.type === 4008) add(decode(atom), location);
        }
      }
    }
    for (const shapeTree of slide.filter(child => child.type === 1036)) drawing(shapeTree, 0);
  }
  if (!passages.length) throw new Error('旧 PPT 的可见幻灯片没有可读取的文本框文字。可将图片页单独导出做文字识别。');
  return passages;
}
