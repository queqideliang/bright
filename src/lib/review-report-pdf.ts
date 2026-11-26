import { jsPDF } from 'jspdf';

export interface ReviewPdfData {
  modelName: string;
  checkedAt?: string | null;
  totalElements?: number | null;
  score?: number | null;
  scope?: string;
  rules: Array<{
    label: string; scope?: string; checked?: number | null; passed?: number | null;
    failed?: number | null; skipped?: number | null; note?: string;
  }>;
  issues: Array<{
    category: string; severity?: string; elementId?: string; elementName?: string; field?: string;
    actual?: string; expected?: string; message?: string; suggestion?: string;
  }>;
}

const ink = '#183930';
const muted = '#4B625A';
const accent = '#00695E';
const fontName = 'ReportSans';
let pendingFont: Promise<string> | undefined;

function loadReportFont(): Promise<string> {
  if (!pendingFont) {
    pendingFont = fetch('/review-report/report-sans-sc.ttf').then(async response => {
      if (!response.ok) throw new Error('报告字体暂时无法加载，请重试。');
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes[0] !== 0 || bytes[1] !== 1 || bytes[2] !== 0 || bytes[3] !== 0) {
        throw new Error('报告字体无效，请刷新后重新导出。');
      }
      const slices: string[] = [];
      for (let offset = 0; offset < bytes.length; offset += 16384) {
        slices.push(String.fromCharCode(...bytes.subarray(offset, offset + 16384)));
      }
      return slices.join('');
    }).catch(error => {
      pendingFont = undefined;
      throw error;
    });
  }
  return pendingFont;
}

const measure = (value?: number | null) =>
  typeof value === 'number' && Number.isFinite(value) ? String(value) : '未记录';
const severities: Record<string, string> = {ERROR:'错误', WARNING:'警告', INFO:'提示'};
const categories: Record<string, string> = {
  EIR:'EIR 信息要求', UNICLASS:'Uniclass 分类', NAMING:'命名规则', NAME:'构件命名',
  CLASSIFICATION:'分类信息', PROPERTY:'必填属性', FILE:'文件命名',
};

function auditDate(value?: string | null) {
  if (!value) return '未记录';
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return value;
  return time.toLocaleString('zh-CN', {timeZone:'Asia/Shanghai',hour12:false}) + '（北京时间）';
}

export async function downloadReviewPdf(data: ReviewPdfData): Promise<void> {
  const font = await loadReportFont();
  const pdf = new jsPDF({unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true,precision:3});
  pdf.addFileToVFS('report.ttf',font);
  pdf.addFont('report.ttf',fontName,'normal');
  pdf.setFont(fontName);
  pdf.setLanguage('zh-CN');
  pdf.setProperties({title:'模型审核报告 · ' + data.modelName, creator:'BRIGHT VISION'});
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const left = 19, right = pageWidth - left;
  const bottom = pageHeight - 20;
  let y = 0;

  function header() {
    pdf.setFontSize(9).setTextColor(accent).text('BRIGHT VISION',left,12);
    pdf.setDrawColor('#A5BEB4').setLineWidth(0.28).line(left,15,right,15);
    y = 24;
  }

  function reserve(height: number) {
    if (y + height > bottom) {
      pdf.addPage();
      header();
    }
  }

  // Accumulate actual glyph advances so Chinese paragraphs and unbroken IFC IDs wrap
  // across both lines and pages. Keep missing glyphs identifiable instead of dropping them.
  const advances = new Map<string, number>();
  const face = pdf.getFont().metadata as {characterToGlyph?(code: number): number};
  function lines(value: string, size: number, width: number, draw: (line: string) => void) {
    pdf.setFontSize(10);
    for (const paragraph of String(value).replace(/\r\n?/gu,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu,'').split('\n')) {
      let line = '', used = 0;
      for (const original of paragraph.replace(/\t/gu,'    ')) {
        const code = original.codePointAt(0)!;
        const token = code > 0xffff || (face.characterToGlyph && !face.characterToGlyph(code))
          ? '[U+' + code.toString(16).toUpperCase() + ']' : original;
        if (!advances.has(token)) {
          // Font units are independent of the current text style.
          advances.set(token, pdf.getStringUnitWidth(token) * 25.4 / 72);
        }
        const advance = advances.get(token)! * size;
        if (line && used + advance > width) { draw(line); line = ''; used = 0; }
        line += token; used += advance;
      }
      draw(line);
    }
  }

  function text(value: string, size = 10, color = ink, indent = 0) {
    const step = size * 0.5 + 0.65;
    lines(value,size,right-left-indent,line => {
      reserve(step);
      pdf.setTextColor(color).setFontSize(size).text(line,left+indent,y);
      y += step;
    });
  }

  function section(label: string) {
    reserve(21);
    y += 2;
    pdf.setFillColor(accent).rect(left,y-3.6,1,4.6,'F');
    text(label,13,accent,3);
    y += 1;
  }

  function field(label: string, value: string | undefined) {
    if (value !== undefined && value !== null) text(label + '　' + (value || '（空值）'),9.3,muted,3);
  }

  header();
  text('模型审核报告',22);
  text(data.modelName || '模型名称未记录',14);
  text('审核时间　' + auditDate(data.checkedAt),9,muted);
  y += 3;
  section('审核概况');
  text('构件记录　' + measure(data.totalElements) + '　　问题　' + data.issues.length + ' 项'
    + (data.score == null ? '' : '　　审核得分　' + measure(data.score) + ' / 100'));
  if (data.scope) text(data.scope,9.3,muted);
  section('规则与检查范围');
  if (!data.rules.length) text('未记录规则明细。',10,muted);
  for (const rule of data.rules) {
    reserve(13);
    text(rule.label,10.5);
    if (rule.scope) field('适用范围',rule.scope);
    text('已检查 ' + measure(rule.checked) + '　　通过 ' + measure(rule.passed)
      + '　　失败 ' + measure(rule.failed) + '　　未检查 ' + measure(rule.skipped),9.3,muted,3);
    if (rule.note) text(rule.note,9.3,muted,3);
    y += 2.5;
  }
  section('问题与整改（' + data.issues.length + ' 项）');
  if (!data.issues.length) text('本次审核未记录问题。',10,muted);
  for (const [index,issue] of data.issues.entries()) {
    reserve(18);
    const severity = issue.severity && (severities[issue.severity] || issue.severity);
    text((index+1) + '. ' + (categories[issue.category] || issue.category || '审核问题') + (severity ? ' · ' + severity : ''),11,accent);
    field('构件',issue.elementName);
    field('构件 ID',issue.elementId);
    field('检查字段',issue.field);
    field('问题',issue.message);
    field('实测值',issue.actual);
    field('期望值',issue.expected);
    field('整改建议',issue.suggestion);
    y += 3;
    if ((index+1)%250===0) await new Promise(resolve=>setTimeout(resolve,0));
  }
  const pages = pdf.getNumberOfPages();
  for (let n=1; n<=pages; n++) {
    pdf.setPage(n).setDrawColor('#D1DFD9').setLineWidth(0.2).line(left,pageHeight-15,right,pageHeight-15);
    pdf.setTextColor(muted).setFontSize(8.5).text('模型审核报告',left,pageHeight-9);
    pdf.text(n + ' / ' + pages,right,pageHeight-9,{align:'right'});
  }
  const filename = [...(data.modelName || '模型').replace(/[<>:"/\\|?*\p{C}]/gu,'_')].slice(0,70).join('').trim();
  await pdf.save((filename || '模型') + '-模型审核报告.pdf',{returnPromise:true});
}
