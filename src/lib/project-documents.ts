import { unzipSync } from 'fflate';

export interface Passage { location: string; text: string }
export interface ProjectDocument { id: string; owner: string; title: string; passages: Passage[] }
const maxText = 1_200_000;

export async function readProjectFile(file: File, options: { allowCloudOcr?: boolean; signal?: AbortSignal } = {}): Promise<Passage[]> {
  if (file.size > 12 * 1024 * 1024) throw new Error('单份资料最大 12 MiB，请拆分文件。');
  if (/\.(xlsx?|csv|tsv)$/i.test(file.name)) return (await import('./project-spreadsheet')).readSpreadsheet(file);
  if (/\.pptx$/i.test(file.name)) {
    const { readPresentation } = await import('./project-presentation');
    if (!options.allowCloudOcr) return readPresentation(file);
    const { readProjectImage } = await import('./project-image');
    return readPresentation(file, { readImage: image => readProjectImage(image, options.signal) });
  }
  if (/\.ppt$/i.test(file.name)) return (await import('./project-legacy-ppt')).readLegacyPresentation(file);
  if (/\.(jpe?g|png|webp)$/i.test(file.name)) {
    if (!options.allowCloudOcr) throw new Error('请先同意将这张图片发送给 AI 识别。');
    return (await import('./project-image')).readProjectImage(file, options.signal);
  }
  const passages: Passage[] = [];
  let length = 0;
  function add(location: string, source: string) {
    const text = source.replace(/\s+/gu, ' ').trim();
    length += text.length;
    if (length > maxText || passages.length >= 6000) throw new Error('这份资料过长，请按章节拆分。');
    for (let i = 0; i < text.length; i += 960) {
      passages.push({ location, text: text.slice(i, i + 1080) });
      if (i + 1080 >= text.length) break;
    }
  }
  if (/\.pdf$/i.test(file.name)) {
    const pdfjs = await import('pdfjs-dist');
    const assets = '/cloud-model-viewer/vendor/pdf/';
    pdfjs.GlobalWorkerOptions.workerSrc = assets + 'pdf.worker.min.mjs';
    const task = pdfjs.getDocument({data: await file.arrayBuffer(), isEvalSupported: false, cMapUrl: assets + 'cmaps/', cMapPacked: true});
    try {
      const pdf = await task.promise;
      if (pdf.numPages > 500) throw new Error('请将超过 500 页的 PDF 按章节拆分。');
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        add('第 ' + n + ' 页', content.items.map(item => 'str' in item ? item.str : '').join(' '));
        page.cleanup();
      }
    } finally { await task.destroy(); }
  } else if (/\.docx$/i.test(file.name)) {
    const xmlPath = 'word/document.xml';
    const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: entry => {
      if (entry.name !== xmlPath) return false;
      if (entry.originalSize > 16 * 1024 * 1024) throw new Error('Word 正文过大，请按章节拆分。');
      return true;
    }});
    if (!entries[xmlPath]) throw new Error('未能读取 Word 正文。');
    const xml = new DOMParser().parseFromString(new TextDecoder().decode(entries[xmlPath]), 'application/xml');
    if (xml.querySelector('parsererror')) throw new Error('Word 正文格式无效。');
    Array.from(xml.getElementsByTagNameNS('*', 'p')).forEach((p, i) => {
      const text = Array.from(p.getElementsByTagNameNS('*', 't')).map(t => t.textContent).join('');
      add('第 ' + (i + 1) + ' 段', text);
    });
  } else if (/\.(txt|md)$/i.test(file.name)) {
    (await file.text()).split(/\r?\n/).forEach((line, i) => add('第 ' + (i + 1) + ' 行', line));
  } else throw new Error('请选择支持的文档、表格、演示文稿或图片。');
  if (!passages.length) throw new Error('未提取到正文。扫描件请先识别文字后再添加。');
  return passages;
}

export { findPassages } from './project-document-search.ts';

async function documentStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open('bright-vision-project-documents', 1);
    opening.onupgradeneeded = () => {
      const store = opening.result.createObjectStore('documents', { keyPath: ['owner','id'] });
      store.createIndex('owner','owner');
    };
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result;
      const tx = db.transaction('documents', mode);
      const request = operation(tx.objectStore('documents'));
      tx.oncomplete = () => { db.close(); resolve(request.result); };
      tx.onabort = () => { db.close(); reject(tx.error ?? new Error('本机资料存储不可用。')); };
    };
  });
}
export const listDocuments = (owner: string): Promise<ProjectDocument[]> => documentStore('readonly', s => s.index('owner').getAll(owner));
export const saveDocument = (doc: ProjectDocument) => documentStore('readwrite', s => s.put(doc));
export const removeDocument = (owner: string, id: string) => documentStore('readwrite', s => s.delete([owner,id]));
