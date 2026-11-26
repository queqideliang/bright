import type { CitedEvidence } from './project-document-search.ts';
import type { ModelFact } from './project-model-evidence.ts';
import { documentScope, floorEquivalent, floorTokens, isWall } from './project-wall-question.ts';

const clean = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\s+/gu, '');
const families = [
  { names: ['门'], ids: ['门', 'door', 'doors', 'ost_doors', 'ifcdoor', 'ifcdoorstandardcase'] },
  { names: ['柱', '柱子'], ids: ['柱', '柱子', '结构柱', '建筑柱', 'column', 'columns', 'structuralcolumns', 'ost_columns', 'ost_structuralcolumns', 'ifccolumn', 'ifccolumnstandardcase'] },
  { names: ['窗', '窗户'], ids: ['窗', '窗户', 'window', 'windows', 'ost_windows', 'ifcwindow', 'ifcwindowstandardcase'] },
  { names: ['梁'], ids: ['梁', 'beam', 'beams', 'ifcbeam', 'ifcbeamstandardcase'] },
  { names: ['楼板'], ids: ['楼板', 'floor', 'floors', 'ost_floors', 'ifcslab', 'ifcslabstandardcase'] },
];
const countQuestion = /多少|几(?:个|根|扇|樘|条|件|个数)|(?:数量|条数|对象数|构件数|总数|记录数|个数)/u;
// Only remove complete count-question terms. An unrecognised material, phase,
// subtype, second floor, negation or comparison must survive and reject the match.
const countTerms = /请问|麻烦|请告诉我|告诉我|我想知道|帮我|帮忙|请|查一下|查询|统计一下|统计|看一下|这个模型|当前模型|该模型|本模型|全模型|整个模型|模型|里面|里边|之中|中的|有多少|总共有|总共|一共有|一共|共有|合计|总计|总构件记录|构件记录|计量对象|构件|记录|数量|条数|总数|个数|多少|几个|几根|几扇|几樘|几条|几件|[有中里的共数是为条个扇根樘件吗呢]/gu;
function simpleCount(remainder: string) {
  return !remainder.replace(countTerms, '').replace(/[?？。]+$/u, '');
}

export function categoryCountSources<T extends {fact: ModelFact}>(question: string, rows: readonly T[], titles: string[] = []): T[] {
  const q = clean(question);
  if (!countQuestion.test(q)) return [];
  const { filesOnly, mixed } = documentScope(question, titles);
  if (filesOnly || mixed) return [];
  const floors = floorTokens(question);
  if (floors.length > 1 || (floors.length && /全模型|整个模型/u.test(q))) return [];
  return rows.filter(({fact}) => {
    let remaining = q;
    if (fact.level !== null) {
      const exact = clean(fact.level);
      if (!exact || /全模型|整个模型/u.test(q)) return false;
      // Match aliases only when both names are whole floor labels ("2F" = "二层").
      const token = floors.find(floor => floorEquivalent(floor, fact.level!));
      if (remaining.includes(exact)) remaining = remaining.replace(exact, '');
      else if (token) remaining = remaining.replace(clean(token), '');
      else return false;
    } else if (floors.length) return false;
    if (fact.category === null) {
      return /构件记录/u.test(q) && (fact.level !== null || /模型/u.test(q)) && simpleCount(remaining);
    }
    if (!fact.category || isWall(fact.category)) return false;
    const actual = clean(fact.category);
    const aliases = families.find(family => family.ids.includes(actual))?.names ?? [];
    return [actual, ...aliases].some(name => remaining.includes(name) && simpleCount(remaining.replace(name, '')));
  });
}

export function computedCategoryAnswer(question: string, sources: CitedEvidence[]) {
  const model = sources.filter((row): row is CitedEvidence & {fact:ModelFact} => row.kind === 'model' && !!row.fact);
  if (new Set(model.map(row => row.title)).size !== 1) return null;
  const matches = categoryCountSources(question, model, sources.map(row => row.title));
  if (matches.length !== 1) return null;
  const { fact, id } = matches[0]!;
  const scope = [fact.level || '全模型', fact.category && '「' + fact.category + '」'].filter(Boolean).join('的');
  const cite = ' [' + id + ']';
  if (fact.category === null || /构件记录|记录数|记录条数/u.test(question)) {
    return { mode:'calculated' as const, answer:scope + '共有 ' + fact.components + ' 条构件记录。' + cite };
  }
  const count = fact.identifiedObjects === fact.objects
    ? '共有 ' + fact.objects + ' 个去重计量对象，对应 ' + fact.components + ' 条构件记录。'
    : '有 ' + fact.components + ' 条构件记录，其中可确认来源的计量对象有 ' + fact.identifiedObjects + ' 个。另有 '
      + (fact.objects - fact.identifiedObjects) + ' 个缺少来源标识，实际去重数量无法核实。';
  return { mode:'calculated' as const, answer:scope + count + cite };
}
