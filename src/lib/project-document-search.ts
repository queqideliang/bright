import { parseModelFact, type ModelFact } from './project-model-evidence.ts';
import { categoryCountSources } from './project-category-answer.ts';
import { documentScope, floorEquivalent, floorTokens, isWall, scopedWalls, wallQuestion } from './project-wall-question.ts';
import { sameTableScope, tableAreas } from './project-wall-table.ts';

export type ProjectEvidence = {title:string;location:string;text:string;kind?:'model';fact?:ModelFact};
export type CitedEvidence = ProjectEvidence & {id:string};
type SearchDocument = {title:string;kind?:string;passages:{location:string;text:string;fact?:unknown}[]};

export function namedModelScopes<T extends {fact:ModelFact}>(model:T[],question:string) {
  const q=question.normalize('NFKC').toLowerCase();
  const explicitLevels=floorTokens(q);
  const levels=explicitLevels.length ? explicitLevels : model.flatMap(({fact})=>fact.level && q.includes(fact.level.toLowerCase())?[fact.level]:[]);
  const exactIfc=q.match(/ifcwall(?:standardcase|elementedcase)?/iu)?.[0];
  const wall=/墙|ifcwall|\bwalls?\b/iu.test(q);
  const categories=[...new Set(model.map(r=>r.fact.category).filter((c):c is string=>!!c && q.includes(c.toLowerCase())))];
  if (!levels.length && !categories.length && !wall) return [];
  return model.filter(({fact})=>fact.category && (levels.length ? !!fact.level && levels.some(level=>floorEquivalent(level,fact.level!)) : fact.level===null)
    && (exactIfc ? fact.category.toLowerCase()===exactIfc : wall ? isWall(fact.category) : !categories.length || categories.includes(fact.category)));
}

function terms(value: string) {
  const words = value.toLowerCase().match(/[a-z0-9_]+|[\p{Script=Han}]+/gu) || [];
  return new Set(words.flatMap(word => {
    if (word.length < 2 || !/\p{Script=Han}/u.test(word)) return [word];
    return Array.from({length: word.length - 1}, (_, i) => word.slice(i, i + 2));
  }));
}

export function findPassages(docs: SearchDocument[], question: string): CitedEvidence[] {
  const query = terms(question);
  const {filesOnly} = documentScope(question,docs.map(d=>d.title));
  const rows: ProjectEvidence[] = docs.filter(d=>!filesOnly || d.kind!=='model').flatMap(doc => doc.passages.map(p => {
    const row = {title:doc.title,location:p.location,text:p.text};
    if (doc.kind !== 'model') return row;
    const fact = parseModelFact(p.fact);
    return {...row,kind:'model' as const,...(fact ? {fact} : {})};
  }));
  const frequency = new Map<string, number>();
  const ranked = rows.map(row => {
    const content = (row.title + ' ' + row.location + ' ' + row.text).toLowerCase();
    const hits = [...query].filter(term => content.includes(term));
    for (const term of hits) frequency.set(term, (frequency.get(term) ?? 0) + 1);
    return {row, hits};
  }).map(({row, hits}) => ({ row, score: hits.reduce((n, term) => n + 1 + Math.log((rows.length + 1) / (frequency.get(term)! + 1)), 0) }));
  const ordered = ranked.sort((a,b) => b.score - a.score).filter(item => rows.length <= 6 || item.score > 0).map(({row})=>row);
  const model = rows.filter((row):row is ProjectEvidence & {fact:ModelFact}=>!!row.fact);
  if (!model.length) return ordered.slice(0,6).map((row,i)=>({id:'S'+(i+1),...row}));
  const q=wallQuestion(question,model.map(row=>row.fact),docs.map(d=>d.title));
  const priority:ProjectEvidence[] = categoryCountSources(question, model, docs.map(doc=>doc.title)).slice(0,3);
  if (q && !q.unsupported) {
    const scoped = scopedWalls(model,q);
    // A model-wide source gives an explicitly cited scope for unanswered floor requests.
    if (scoped.length) priority.push(...scoped.slice(0,3));
    else {
      priority.push(...model.filter(r=>r.fact.scope==='level' && q.levels.includes(r.fact.level!)).slice(0,2));
      priority.push(...model.filter(r=>r.fact.scope==='model').slice(0,1));
    }
    if (q.compare) {
      const tables = rows.filter(r=>r.kind!=='model' && /\.(?:xlsx?|csv|tsv)$/iu.test(r.title))
        .map(row=>({row,areas:tableAreas(row)})).filter(r=>r.areas.length);
      const inScope=tables.filter(({areas})=>areas.some(a=>sameTableScope(a.scope,q)));
      const candidates=inScope.length?inScope:tables;
      const sorted=[...candidates.filter(r=>r.areas.some(a=>a.total)),...candidates.filter(r=>!r.areas.some(a=>a.total))];
      priority.push(...sorted.slice(0,3).map(r=>r.row));
    }
  } else if (/模型/u.test(question)) {
    priority.push(...namedModelScopes(model,question).slice(0,2));
  }
  if (ordered.length) {
    const modelHit=ordered.find(row=>row.kind==='model'),fileHit=ordered.find(row=>row.kind!=='model');
    if (fileHit) priority.push(fileHit);
    if (modelHit) priority.push(modelHit);
  }
  const selected:CitedEvidence[]=[];
  let bytes=0;
  for (const row of new Set([...priority,...ordered])) {
    const source={id:'S'+(selected.length+1), ...row};
    const size=new TextEncoder().encode(JSON.stringify(source)).length+1;
    if (bytes+size>43_000) continue;
    bytes+=size; selected.push(source);
    if (selected.length===8) break;
  }
  return selected;
}

