import { readOfficeParts } from './project-office-zip.ts';

type Passage = { location: string; text: string };
type ImageReference = { after: number; location: string; resource: string };
type Options = { readImage?: (file: File) => Promise<Passage[]> };
const relNamespaces = ['http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'http://purl.oclc.org/ooxml/officeDocument/relationships'];
const children = (node: Element, name: string) => Array.from(node.children).filter(child => child.localName === name);
const within = (node: Document | Element, name: string) => Array.from(node.getElementsByTagNameNS('*', name));

function packagePath(base: string, target: string) {
  if (!target || target.includes('\\') || /^(?:[a-z][\w+.-]*:|\/\/)/i.test(target)) throw new Error('幻灯片存在无效的文件关系。');
  const url = new URL(target, 'https://office.invalid/' + base);
  if (url.origin !== 'https://office.invalid' || url.search || url.hash) throw new Error('幻灯片文件关系不是本机正文。');
  return decodeURIComponent(url.pathname.slice(1));
}

/** Visit shapes and paragraphs in their slide XML order, keeping text runs in each paragraph together. */
function paragraphs(node: Element) {
  return within(node, 'p').map(p => Array.from(p.children).map(child => child.localName === 'br' ? '\n'
    : ['r', 'fld'].includes(child.localName) ? within(child, 't').map(t => t.textContent || '').join('') : '').join('').trim()).filter(Boolean);
}

export async function readPresentation(file: File, options: Options = {}): Promise<Passage[]> {
  if (/\.ppt$/i.test(file.name)) throw new Error('请在 PowerPoint 或 WPS 中将旧版 PPT 另存为 .pptx 后添加。');
  if (!/\.pptx$/i.test(file.name)) throw new Error('请选择 PPTX 演示文稿。');
  if (file.size > 12 * 1024 * 1024) throw new Error('单份演示文稿最大 12 MiB，请按章节拆分。');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('演示文稿格式无效或已加密，请另存为可读取的 .pptx。');
  const parts = readOfficeParts(bytes, path => path === '_rels/.rels' || /^ppt\/.*\.(?:xml|rels)$/i.test(path));
  function xml(path: string) {
    if (!parts[path]) throw new Error('演示文稿中缺少引用的正文部件：' + path.slice(0, 120));
    const source = new TextDecoder('utf-8', { fatal: true }).decode(parts[path]);
    if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(source)) throw new Error('演示文稿包含不支持的 XML 声明。');
    const doc = new DOMParser().parseFromString(source, 'application/xml');
    if (within(doc, 'parsererror').length) throw new Error('演示文稿 XML 无法解析，请重新另存。');
    return doc;
  }
  const office = within(xml('_rels/.rels'), 'Relationship').find(rel => rel.getAttribute('Type')?.endsWith('/officeDocument'));
  if (!office || office.getAttribute('TargetMode') === 'External') throw new Error('无法识别演示文稿主文件。');
  const main = packagePath('', office.getAttribute('Target') || '');
  const list = within(xml(main), 'sldIdLst')[0];
  if (!list) throw new Error('演示文稿缺少幻灯片目录。');
  const slideIds = children(list, 'sldId');
  if (slideIds.length > 500) throw new Error('请将超过 500 张的演示文稿按章节拆分。');
  const relFile = main.replace(/([^/]+)$/u, '_rels/$1.rels');
  const slidePaths = new Map<string, string>();
  for (const rel of within(xml(relFile), 'Relationship')) {
    if (rel.getAttribute('Type')?.endsWith('/slide') && rel.getAttribute('TargetMode') !== 'External') {
      const id = rel.getAttribute('Id');
      if (!id || slidePaths.has(id)) throw new Error('幻灯片引用编号无效。');
      slidePaths.set(id, packagePath(main, rel.getAttribute('Target') || ''));
    }
  }
  const passages: Passage[] = [];
  const pictures: ImageReference[] = [];
  let characters = 0, fragments = 0;
  function add(location: string, text: string, output = passages) {
    for (let start = 0; start < text.length; start += 1024) {
      const piece = text.slice(start, start + 1100);
      characters += piece.length + location.length;
      if (characters > 1_200_000 || ++fragments > 6000) throw new Error('演示文稿正文过长，请拆分文件。');
      output.push({ location, text: piece });
      if (start + 1100 >= text.length) break;
    }
  }
  for (const [index, sld] of slideIds.entries()) {
    const id = relNamespaces.map(ns => sld.getAttributeNS(ns, 'id')).find(Boolean);
    const path = id && slidePaths.get(id);
    if (!path) throw new Error('找不到第 ' + (index + 1) + ' 张幻灯片的正文。');
    const slide = xml(path);
    if (/^(?:0|false)$/i.test(slide.documentElement.getAttribute('show') ?? '')) continue;
    const label = '第 ' + (index + 1) + ' 张幻灯片';
    const before = passages.length;
    const tree = within(slide, 'spTree')[0];
    if (!tree) throw new Error(label + '缺少形状树。');
    let shapes = 0, tables = 0;
    for (const node of Array.from(tree.getElementsByTagName('*'))) {
      if (node.localName === 'sp' || node.localName === 'cxnSp') {
        const body = children(node, 'txBody')[0];
        if (body) {
          shapes++;
          const text = paragraphs(body).join('\n');
          if (text) add(label + ' · 文本框 ' + shapes, text);
        }
      } else if (node.localName === 'tbl') {
        tables++;
        const rows = children(node, 'tr');
        const headers = rows.length ? children(rows[0], 'tc').map(cell => paragraphs(cell).join(' ')) : [];
        for (const [r, row] of rows.entries()) {
          const cells = children(row, 'tc');
          const pieces: string[] = [];
          let first = 0, last = 0, size = 0;
          const flush = () => {
            if (pieces.length) add(label + ' · 表 ' + tables + ' 第 ' + (r + 1) + ' 行 · 第 ' + first + '–' + last + ' 列', pieces.join('；'));
            pieces.length = 0; size = 0;
          };
          for (const [c, cell] of cells.entries()) {
            const value = paragraphs(cell).join(' ');
            if (!value) continue;
            const header = r > 0 && headers[c]?.length <= 80 ? headers[c] : '';
            const piece = '第 ' + (c + 1) + ' 列 ' + (header ? header + '=' : '') + value;
            if (size + piece.length > 1024) flush();
            if (!pieces.length) first = c + 1;
            last = c + 1;
            pieces.push(piece); size += piece.length + 1;
          }
          flush();
        }
      }
    }
    const images = within(tree, 'blip');
    if (images.length && options.readImage) {
      const relPath = path.replace(/([^/]+)$/u, '_rels/$1.rels');
      const relations = new Map((parts[relPath] ? within(xml(relPath), 'Relationship') : [])
        .filter(rel => rel.getAttribute('Type')?.endsWith('/image')).map(rel => [rel.getAttribute('Id'), rel]));
      for (const [position, blip] of images.entries()) {
        const location = label + ' · 图 ' + (position + 1);
        const embed = relNamespaces.map(ns => blip.getAttributeNS(ns, 'embed')).find(Boolean);
        const relation = embed ? relations.get(embed) : undefined;
        if (!relation || relation.getAttribute('TargetMode') === 'External') {
          add(location, '图片没有可读取的内嵌图像资源，外部链接不参与识别。');
          continue;
        }
        const resource = packagePath(path, relation.getAttribute('Target') || '');
        if (!/\.(?:png|jpe?g|webp)$/iu.test(resource)) {
          add(location, '此嵌入图片格式暂不支持识别，支持 PNG、JPEG 和 WebP。');
          continue;
        }
        if (pictures.length >= 100) throw new Error('图片识别一次最多支持 100 处嵌入图片引用，请拆分演示文稿或选择只读正文。');
        pictures.push({ after: passages.length, location, resource });
      }
    } else if (images.length) add(label, '本页含图片，图片中的文字未纳入幻灯片正文。');
    else if (before === passages.length) add(label, '本页没有可提取的文本框或表格文字。');
  }
  if (!passages.length && !pictures.length) throw new Error('演示文稿没有可读取的可见幻灯片。');
  if (!options.readImage || !pictures.length) return passages;

  // Resolve and budget every visible image before the first provider call.
  const paths = new Set(pictures.map(picture => picture.resource));
  const files = readOfficeParts(bytes, path => paths.has(path));
  const canonical = new Map<string, string>();
  const unique: string[] = [];
  let imageBytes = 0;
  for (const path of paths) {
    const data = files[path];
    if (!data?.length) throw new Error('可见幻灯片引用的嵌入图片缺失，请重新保存或选择只读正文。');
    if (data.length > 8 * 1024 * 1024) throw new Error('单张嵌入图片超过 8 MiB，请压缩图片或选择只读正文。');
    const same = unique.find(key => files[key].length === data.length && data.every((v, i) => v === files[key][i]));
    canonical.set(path, same ?? path);
    if (!same) { unique.push(path); imageBytes += data.length; }
    if (unique.length > 8 || imageBytes > 16 * 1024 * 1024) throw new Error('一次最多识别 8 张不同的嵌入图片，合计不超过 16 MiB。请拆分演示文稿或选择只读正文。');
  }
  const cache = new Map<string, Passage[]>();
  const result: Passage[] = [];
  let nextText = 0;
  for (const picture of pictures) {
    while (nextText < picture.after) result.push(passages[nextText++]);
    const key = canonical.get(picture.resource)!;
    let recognized = cache.get(key);
    if (!recognized) {
      const name = key.slice(key.lastIndexOf('/') + 1);
      const type = /\.png$/i.test(name) ? 'image/png' : /\.webp$/i.test(name) ? 'image/webp' : 'image/jpeg';
      try {
        recognized = await options.readImage(new File([Uint8Array.from(files[key])], name, { type }));
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') throw error;
        throw new Error(picture.location + ' 图片识别失败：' + (error instanceof Error ? error.message : '请稍后重试，或选择只读正文。'));
      }
      cache.set(key, recognized);
    }
    if (!recognized.length) add(picture.location, '此图未识别出文字。', result);
    for (const part of recognized) add(picture.location + ' · ' + part.location.slice(0, 150), part.text, result);
  }
  while (nextText < passages.length) result.push(passages[nextText++]);
  return result;
}
