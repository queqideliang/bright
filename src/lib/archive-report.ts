type Fields = Record<string, unknown>;
type Summary = { label: string; total?: number; errors?: number; warnings?: number; passed?: number };
type Issue = {
  category: string; severity?: string; elementId?: string; elementName?: string; field?: string;
  actual?: string; expected?: string; message?: string; suggestion?: string;
};
export type ArchiveReport = {
  modelName: string; checkedAt: string; totalElements?: number; score?: number; scope: string;
  summaries: Summary[]; rules: {label: string; passed?: number; note: string}[]; issues: Issue[];
};

const categoryLabels: Record<string, string> = { NAMING: '文件命名', UNICLASS: 'Uniclass 2015 分类', EIR: 'EIR 信息要求' };
const severities: Record<string, string> = { ERROR: '错误', WARNING: '警告', INFO: '提示' };
const fields = (v: unknown): v is Fields => !!v && typeof v === 'object' && !Array.isArray(v);
const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;
const text = (v: unknown) => typeof v === 'string' && v.trim() ? v : undefined;

function originalValue(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return '（空值）';
  if (value === '') return '（空字符串）';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function label(labels: Record<string,string>, value: unknown) {
  const key = text(value);
  if (!key) return undefined;
  const normalized = key.toUpperCase();
  return Object.hasOwn(labels, normalized) ? labels[normalized] : key;
}

/** Historical summary.total counts findings. It does not measure how many elements were checked. */
export function readArchiveReport(raw: unknown, fileName: string): ArchiveReport | null {
  if (!fields(raw) || !['checkedAt','totalElements','complianceScore','summary','issues','_note'].some(k => Object.hasOwn(raw,k))) return null;
  const summaries: Summary[] = [];
  if (fields(raw.summary)) {
    for (const [key, item] of Object.entries(raw.summary)) {
      if (fields(item)) summaries.push({ label:label(categoryLabels,key) ?? key, total:number(item.total),
        passed:number(item.passed), errors:number(item.errors), warnings:number(item.warnings) });
    }
  }
  const rules = summaries.map(s => {
    const metrics = [['问题',s.total], ['错误',s.errors], ['警告',s.warnings]].filter(([,v]) => v !== undefined);
    return { label:s.label, passed:s.passed, note:metrics.map(([k,v]) => k+' '+v).join('，') };
  });
  const suggestions = fields(raw.fixSuggestions) ? raw.fixSuggestions : {};
  const issues: Issue[] = [];
  if (Array.isArray(raw.issues)) {
    for (const item of raw.issues) {
      if (!fields(item)) continue;
      const id = text(item.id);
      issues.push({
        category:label(categoryLabels,item.category) ?? '分类未记录', severity:label(severities,item.severity),
        elementId:originalValue(item.elementId), elementName:text(item.elementType), field:text(item.field),
        actual:originalValue(item.currentValue), expected:originalValue(item.expectedFormat), message:text(item.message),
        suggestion:text(item.suggestion) ?? (id && Object.hasOwn(suggestions,id) ? text(suggestions[id]) : undefined),
      });
    }
  }
  const notes = [text(raw.scope),text(raw._note)].filter(Boolean);
  if (!Array.isArray(raw.issues)) notes.push('原报告未保存问题明细。');
  else if (issues.length !== raw.issues.length) notes.push('部分历史明细格式无法读取。');
  const total = summaries.reduce((n,s) => n + (s.total ?? 0),0);
  if (total > issues.length) notes.push('原报告分类摘要列出 '+total+' 项问题，留存的可读明细为 '+issues.length+' 项。');
  return { modelName:text(raw.modelName) ?? fileName, checkedAt:text(raw.checkedAt) ?? '未记录',
    totalElements:number(raw.totalElements), score:number(raw.complianceScore), scope:notes.join('\n'),
    summaries, rules, issues };
}

export const archiveId = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/iu;
export const reportsPerPage = 20;
const reportDate = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', year:'numeric', month:'2-digit', day:'2-digit',
  hour:'2-digit', minute:'2-digit', hourCycle:'h23',
});
export function archiveDate(value: string) {
  // Keep legacy date-only or unzoned strings exactly as recorded.
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/iu.test(value)) return value;
  const instant = Date.parse(value);
  return Number.isFinite(instant) ? reportDate.format(instant)+'（北京时间）' : value;
}
export function archivePage(value: unknown) {
  return typeof value === 'string' && /^[1-9]\d{0,5}$/u.test(value) ? Number(value) : 1;
}
export function reportsUrl(page: number, model?: string) {
  const query = new URLSearchParams();
  if (model && archiveId.test(model)) query.set('model',model);
  if (page > 1) query.set('page',String(page));
  return query.size ? '/reports?'+query : '/reports';
}
