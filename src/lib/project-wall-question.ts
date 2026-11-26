import type { ModelFact } from './project-model-evidence.ts';

export const wallUnion = '墙体（全部墙类）';
export function isWall(category: string | null) {
  return category === wallUnion || /^(墙|墙体|walls?|ost_walls|ifcwall(?:standardcase|elementedcase)?)$/iu.test(category ?? '');
}

function clean(text: string) {
  return text.normalize('NFKC').toLowerCase().replace(/[\s_]+/gu, '');
}
const digit = '零〇一二两三四五六七八九十百';
function floorNumber(raw: string) {
  if (/^\d+$/.test(raw)) return String(Number(raw));
  const cn = '零一二三四五六七八九';
  let total = 0, n = 0;
  for (const char of raw.replace(/两/g,'二').replace(/〇/g,'零')) {
    if (char === '百' || char === '十') { total += (n || 1)*(char==='百'?100:10); n=0; }
    else n=cn.indexOf(char);
  }
  return String(total+n);
}
const floorPattern = new RegExp('(?:地下|负)?第?[0-9'+digit+']+(?:层|楼)|(?:地下|负)?首层|(?<![a-z0-9])(?:level|floor|l|f|b)\\s*[-_]?\\s*\\d+(?![a-z0-9])|(?<![a-z0-9])\\d+f(?![a-z0-9])','giu');
export function floorTokens(value: string) {
  return [...value.normalize('NFKC').matchAll(floorPattern)].map(m=>m[0]);
}
function floorTokenKey(token: string) {
  const tokenDigits = token.replace(/首/g,'一').match(new RegExp('[0-9'+digit+']+','u'));
  return (/(?:地下|负)|^b|(?:level|floor|l|f)\s*-\s*\d/i.test(token) ? '-' : '') + floorNumber(tokenDigits?.[0] ?? '');
}
export function floorEquivalent(a: string, b: string) {
  if (clean(a) === clean(b)) return true;
  const left = floorTokens(a), right = floorTokens(b);
  return left.length === 1 && right.length === 1 && clean(a) === clean(left[0]) && clean(b) === clean(right[0])
    && floorTokenKey(left[0]) === floorTokenKey(right[0]);
}

const fileReference = /资料|图纸|文件|文档|清单|台[账帐]|工程量表|面积表|统计表|汇总表|明细表|工作表|表格|表[内中里]|excel|合同|规范|图集|附件|报告|说明书|\.(?:xlsx?|csv|tsv|pdf|docx?|pptx?|md|txt)\b/iu;
const comparison = /对比|比对|比较|核对|对照|相差|差值|差异|差多少|差额|一致|是否相同|多多少|少多少|差了|相符/u;
const tableReference = /清单|台[账帐]|工程量表|面积表|统计表|汇总表|明细表|工作表|表格|表[内中里]|excel|\.(?:xlsx?|csv|tsv)\b/iu;

export function documentScope(question: string, titles: string[]) {
  const q = question.normalize('NFKC').toLowerCase().replace(/模型文件|模型资料/gu,'模型');
  const files = titles.filter(t=>/\.(?:xlsx?|csv|tsv|pdf|docx?|pptx?|md|txt)$/iu.test(t)).map(t=>t.normalize('NFKC').toLowerCase());
  const mentionsFile = (part:string) => fileReference.test(part) || files.some(name=>part.includes(name));
  const hasFiles = mentionsFile(q);
  const mentionsModel = /模型|\b(?:revit|ifc|bim)\b/iu.test(q);
  // In “二层墙面积和工程量表相差多少”, the first operand is the selected model.
  // In “图纸的墙面积和清单相差多少”, both operands are documents.
  const parts = q.split(/与|和|跟|对比|比对|相比|比较/u);
  const implicitModel = comparison.test(q) && parts.some((part,i)=>i>0 && mentionsFile(part)
    && /墙|\bwalls?\b|ifcwall/iu.test(parts.slice(0,i).join('')) && !mentionsFile(parts.slice(0,i).join('')));
  const filesOnly = hasFiles && !mentionsModel && !implicitModel;
  const mixed = hasFiles && !filesOnly;
  const namedNonTable = files.some(name=>q.includes(name) && !/\.(?:xlsx?|csv|tsv)$/iu.test(name));
  const compareTable = mixed && comparison.test(q) && !namedNonTable && !/图纸|合同|规范|图集|报告|说明书|\.pdf\b|\.docx?\b|\.pptx?\b/iu.test(q)
    && (tableReference.test(q) || /资料|文件|文档|附件/u.test(q));
  return {filesOnly,mixed,compareTable};
}

export function wallQuestion(question: string, facts: ModelFact[], titles: string[] = []) {
  const q = question.normalize('NFKC');
  if (!/墙|\bwalls?\b|IfcWall/i.test(q)) return null;
  const area = /面积|sidearea|host_area_computed|平方米|平米|多少平方|\bm2\b|\barea\b/i.test(q);
  const count = /数量|个数|构件数|对象数|[多少几]+\s*(?:面(?!积)|堵|道|个(?!平方|平米)|项|片)|多少(?:个)?墙|\bcount\b/i.test(q) || (!area && /多少|几面|几堵|几道/.test(q));
  if (!area && !count) return null;
  const {filesOnly:fileOnly,mixed,compareTable:compare} = documentScope(q,titles);
  const distinctLevels = [...new Set(facts.map(f=>f.level).filter((v): v is string=>!!v))];
  const tokens = floorTokens(q);
  const exact = distinctLevels.filter(l => {
    if (floorTokens(l).some(t=>clean(l)===clean(t))) return tokens.some(t=>clean(t)===clean(l));
    return clean(q).includes(clean(l));
  });
  const levels = [...new Set([...exact, ...tokens.filter(t=>!exact.some(l=>clean(l).includes(clean(t)) || floorEquivalent(t,l)))])];
  const category = q.match(/IfcWall(?:StandardCase|ElementedCase)?/i)?.[0];
  const kind = /净侧?面积|netsidearea/i.test(q) ? 'NetSideArea'
    : /毛侧?面积|grosssidearea/i.test(q) ? 'GrossSideArea' : null;
  // Deterministic totals apply only to simple quantity questions. Unknown qualifiers, types and
  // compound tasks must not silently turn into a whole-model wall total.
  let remaining = q.toLowerCase();
  for (const text of [...titles,...levels, ...tokens,...distinctLevels.filter(l=>exact.includes(l))].sort((a,b)=>b.length-a.length)) {
    const target = text.normalize('NFKC').toLowerCase(); if (target) remaining=remaining.split(target).join('');
  }
  remaining=remaining.replace(/帮我|我想知道|麻烦|帮忙|查看|查询|看一下|查一下|算一下|统计一下|看看|算算|看下|查下|上传的?|工程量表|工程量清单|工程量汇总表|这栋楼|这座楼|这份|这个|该项目|请列出|请说明|请计算|回答|总共有|总共有几|相差多少|差多少|如何相差|有几|请用|分别是|分别有|它们|所有|现有|已打开|还有|的呢|给我|小计|汇总/gu,'');
  remaining=remaining.replace(/host_area_computed|ifcwall(?:standardcase|elementedcase)?|netsidearea|grosssidearea|excel|\.xlsx?|模型|资料|图纸|文件|工作表|表格|清单|台账|统计表|面积表|明细表|汇总表|计量对象|构件记录|构件|记录|对象|墙体|墙|墙面|side\s*area|wall(?:s)?|area|count|平方米|平米|m2|净侧面积|毛侧面积|净面积|毛面积|面积|数量|个数|总计|一共|总共|共有|合计|总量|总数|总面积|全楼|全模型|全部|整个|整栋|全项目|本项目|当前|已选|所选|项目|现场|楼层|楼里|各有|分别|统计|计算|数值|数字|准确|多少|几面|几堵|几道|结果|请问|请给出|给出|请告诉我|告诉我|上面|里面|中的|中有|引用|原文|来源|依据|出处|单位|并列出|列出|提供|对比|比对|比较|核对|对照|相差|差值|差异|差多少|差额|一致|是否相同|多多少|少多少|相符|差了|是否|哪个|平方|[含与和及为的共有请问下是在中里各跟按比将把以并差了有总几面堵个道些吗呢多少两]/giu,'')
    .replace(/[\s\p{P}\p{S}]+/gu,'');
  const breakdown = /按(?:各)?楼层|各(?:个)?(?:楼层|层)|每(?:个|一)?(?:楼层|层)|分(?:楼)?层|逐(?:楼)?层/u.test(q);
  const unsupported = remaining.length > 0 || fileOnly || breakdown || (mixed && !compare) || (comparison.test(q) && !compare);
  return { area, count, compare, fileOnly, levels, category, kind, unsupported };
}
export type WallQuestion = NonNullable<ReturnType<typeof wallQuestion>>;

export function scopedWalls<T extends {fact: ModelFact}>(rows: T[], q: WallQuestion): T[] {
  const matches = rows.filter(({fact:f}) => isWall(f.category) && (!q.category || f.category?.toLowerCase()===q.category.toLowerCase())
    && (q.levels.length ? !!f.level && q.levels.some(level=>floorEquivalent(level,f.level!)) : f.level === null));
  return matches.filter(({fact}) => q.category || fact.category === wallUnion
    || !matches.some(({fact:f})=>f.level === fact.level && f.category === wallUnion));
}
