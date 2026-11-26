import { read, utils, type CellObject, type WorkBook } from 'xlsx';
import { zipSync } from 'fflate';
import { readOfficeParts } from './project-office-zip.ts';

type Passage = { location: string; text: string };
type Value = { address: string; col: number; text: string; label: boolean };
const maxCells = 80000;
const maxRows = 6000;
const maxCellText = 2200;
const noCache = '（文件未保存可读取的公式缓存）';
const failSize = () => new Error('工作簿内容过多，请按工作表或业务范围拆分后添加。');

// SheetJS supplies numeric zero for a formula without a cached value. Preserve that distinction
// while checking the number of XML cells before constructing the workbook object.
function prepareXlsx(bytes: Uint8Array) {
  const xml = readOfficeParts(bytes, name => name === '[Content_Types].xml' || /^(?:xl\/|_rels\/).*\.(?:xml|rels)$/i.test(name));
  if (!xml['xl/workbook.xml']) throw new Error('文件缺少 XLSX 工作簿正文。');
  let cells = 0;
  for (const name of Object.keys(xml)) {
    if (!/^xl\/worksheets\/[^/]+\.xml$/i.test(name)) continue;
    const source = new TextDecoder('utf-8', { fatal: true }).decode(xml[name]);
    const checked = source.replace(/<((?:[\w.-]+:)?c)(?=[\s>])([^>]*?)(\/>|>([\s\S]*?)<\/\1\s*>)/gu,
      (full, tag: string, attributes: string, _end: string, body: string | undefined) => {
        if (++cells > maxCells) throw failSize();
        if (!body || !/<(?:[\w.-]+:)?f(?=[\s/>])/u.test(body)) return full;
        if (/<(?:[\w.-]+:)?v(?:\s[^>]*)?>[^<]+<\//u.test(body)) return full;
        const prefix = tag.slice(0, -1);
        const cleaned = body.replace(/<(?:[\w.-]+:)?v(?:\s[^>]*)?\s*\/>|<(?:[\w.-]+:)?v(?:\s[^>]*)?>\s*<\/(?:[\w.-]+:)?v\s*>/gu, '');
        const attrs = attributes.replace(/\s+t\s*=\s*(?:"[^"]*"|'[^']*')/u, '');
        return '<' + tag + attrs + ' t="str">' + cleaned + '<' + prefix + 'v>' + noCache + '</' + prefix + 'v></' + tag + '>';
      });
    if (checked !== source) xml[name] = new TextEncoder().encode(checked);
  }
  return zipSync(xml, { level: 0 });
}

function csvWorkbook(bytes: Uint8Array, delimiter: string): WorkBook {
  let source: string;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) source = new TextDecoder('utf-16le').decode(bytes);
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) source = new TextDecoder('utf-16be').decode(bytes);
  else {
    try { source = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { source = new TextDecoder('gb18030', { fatal: true }).decode(bytes); }
  }
  const rows: string[][] = [];
  let row: string[] = [], value = '', quoted = false, closed = false, count = 0;
  function field() {
    if (++count > maxCells) throw failSize();
    row.push(value); value = ''; closed = false;
  }
  function nextRow() { field(); if (rows.length >= maxRows) throw failSize(); rows.push(row); row = []; }
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted && ch === '"') {
      if (source[i + 1] === '"') { value += '"'; i++; } else { quoted = false; closed = true; }
    } else if (!quoted && ch === delimiter) field();
    else if (!quoted && (ch === '\r' || ch === '\n')) {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      nextRow();
    } else if (!quoted && ch === '"' && !value && !closed) quoted = true;
    else if (closed) throw new Error('表格文本的引号或分隔符格式有误。');
    else value += ch;
    if (value.length > maxCellText) throw new Error('表格单元格内容过长，请将长文本拆分。');
  }
  if (quoted) throw new Error('表格文本包含未闭合的引号。');
  if (row.length || value || closed) nextRow();
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, utils.aoa_to_sheet(rows), '数据');
  return workbook;
}

function formatted(cell: CellObject) {
  if (cell.f || cell.F) {
    if (cell.v == null || cell.v === noCache || cell.t === 'z') return noCache;
    return '公式缓存值 ' + (cell.w || String(cell.v)) + '（未重算）';
  }
  if (cell.t === 'z' || cell.v == null) return '';
  return cell.w ?? String(cell.v);
}

const headerWord = /编号|类别|编码|名称|楼层|单位|工程量|面积|数量|体积|长度|^ID$|^Name$|^Level$|^Quantity$/i;
function headerOf(rows: Value[][]) {
  let best: Value[] = [], bestScore = 0;
  for (const row of rows.slice(0, 15)) {
    if (row.length < 2 || row.some(cell => !cell.label || cell.text.length > 120)) continue;
    const matches = row.filter(cell => headerWord.test(cell.text)).length;
    const score = 1 + Math.min(matches, 8) * 2;
    if (score > bestScore) { best = row; bestScore = score; }
  }
  return best;
}

export async function readSpreadsheet(file: File): Promise<Passage[]> {
  if (file.size > 12 * 1024 * 1024) throw new Error('单份表格最大 12 MiB，请拆分文件。');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let workbook: WorkBook;
  if (/\.(csv|tsv)$/i.test(file.name)) {
    workbook = csvWorkbook(bytes, /\.tsv$/i.test(file.name) ? '\t' : ',');
  } else {
    const modern = /\.xlsx$/i.test(file.name);
    const cfb = [0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1].every((value, i) => bytes[i] === value);
    const biff = bytes[0] === 9 && [0,2,4,8].includes(bytes[1]);
    if (modern ? bytes[0] !== 0x50 || bytes[1] !== 0x4b : !/\.xls$/i.test(file.name) || !(cfb || biff)) {
      throw new Error('文件内容与 Excel 格式不符，请另存为标准 XLSX 或 XLS。');
    }
    const source = modern ? prepareXlsx(bytes) : bytes;
    workbook = read(source, { type: 'array', dense: false, cellFormula: true, cellText: true,
      cellHTML: false, bookVBA: false, bookDeps: false, sheetStubs: false, WTF: true });
  }
  if (workbook.SheetNames.length > 150) throw failSize();
  const passages: Passage[] = [];
  let cells = 0, rowCount = 0, characters = 0;
  function add(location: string, text: string) {
    characters += text.length + location.length;
    if (characters > 1_200_000 || passages.length >= 6000) throw failSize();
    passages.push({ location, text });
  }
  for (const [index, name] of workbook.SheetNames.entries()) {
    if (workbook.Workbook?.Sheets?.[index]?.Hidden) continue;
    const sheet = workbook.Sheets[name];
    if (!sheet || (sheet['!type'] && sheet['!type'] !== 'sheet')) continue;
    if (name.length > 100) throw new Error('工作表名称过长，请先缩短名称。');
    const byRow = new Map<number, Value[]>();
    // A formatting range or merged title may span the entire grid. Visit only stored cells.
    for (const address of Object.keys(sheet)) {
      if (address.startsWith('!')) continue;
      if (++cells > maxCells) throw failSize();
      if (!/^[A-Z]{1,3}[1-9]\d{0,6}$/.test(address)) throw new Error('工作表的单元格地址无效。');
      const cell = sheet[address] as CellObject;
      const value = formatted(cell);
      if (!value.trim()) continue;
      if (value.length > maxCellText) throw new Error('工作表“' + name + '”的 ' + address + ' 内容过长，请将长文本拆分。');
      const point = utils.decode_cell(address);
      let row = byRow.get(point.r);
      if (!row) { if (++rowCount > maxRows) throw failSize(); row = []; byRow.set(point.r, row); }
      row.push({ address, col: point.c, text: value, label: cell.t === 's' && !cell.f });
    }
    const rows = [...byRow.entries()].sort((a,b) => a[0] - b[0]).map(([, row]) => row.sort((a,b) => a.col - b.col));
    const header = headerOf(rows);
    const labels = new Map<number, string>();
    for (const row of rows) {
      const isHeader = row === header;
      if (isHeader) for (const cell of row) labels.set(cell.col, cell.text);
      const identifiers = !isHeader ? row.filter(cell => /编号|编码|^ID$|^单位$|^计量单位$/iu.test(labels.get(cell.col) ?? '') && cell.text.length <= 80).slice(0, 3) : [];
      const context = identifiers.map(cell => labels.get(cell.col) + '=' + cell.text).join('，');
      const prefix = (isHeader ? '表头。' : '') + (context ? context + '。' : '');
      let segment: string[] = [], first = '', last = '', size = 0;
      function flush() {
        if (segment.length) add('工作表「' + name + '」!' + (first === last ? first : first + ':' + last), prefix + segment.join('；'));
        segment = []; size = 0;
      }
      for (const cell of row) {
        const label = isHeader ? '' : labels.get(cell.col);
        const part = cell.address + ' ' + (label ? label + '=' : '') + cell.text;
        if (size + part.length > 1050) flush();
        if (!segment.length) first = cell.address;
        segment.push(part); size += part.length + 1; last = cell.address;
      }
      flush();
    }
  }
  if (!passages.length) throw new Error('可见工作表中没有可读取的单元格数据。');
  return passages;
}
