import type { CitedEvidence } from './project-document-search.ts';
import type { ModelFact, ModelMetric } from './project-model-evidence.ts';
import { floorEquivalent, scopedWalls, wallQuestion } from './project-wall-question.ts';
import { differenceText, sameTableScope, sameWallCategory, tableAreas } from './project-wall-table.ts';

type ModelSource=CitedEvidence & {fact:ModelFact};
type Area={basis:string;label:string;metric:ModelMetric};
const labelFor = (name:string) => name === 'NetSideArea' ? '净侧面积' : name === 'GrossSideArea' ? '毛侧面积' : '面积';

function areas(fact:ModelFact,kind:string|null): Area[] {
  if (fact.source==='ifc') {
    const named=(fact.ifcQuantities ?? []).filter(a=>a.metric==='area');
    const picked=kind ? named.filter(a=>a.name.toLowerCase()===kind.toLowerCase()) : named;
    return picked.map(a=>({basis:a.name,label:labelFor(a.name)+'（'+a.group+'.'+a.name+'）',metric:a}));
  }
  return [{basis:fact.source==='revit-parameters' ? 'HOST_AREA_COMPUTED' : '',label:fact.source==='revit-parameters'
    ? 'Revit 原始面积（HOST_AREA_COMPUTED）' : '模型记录的面积',metric:fact.metrics.area}];
}
function areaText(area:Area,objects:number) {
  const m=area.metric;
  const coverage='有效 '+m.available+'/'+objects+' 个计量对象'
    +(m.missing?'，缺失 '+m.missing:'')+(m.invalid?'，无效 '+m.invalid:'')+(m.unavailable?'，无可用来源 '+m.unavailable:'');
  if (m.value===null) return area.label+(m.overflow?'合计超出数值范围':'没有可用合计')+'（'+coverage+'）';
  return area.label+(m.available===objects?'合计 ':'已取到的部分合计 ')+m.value+' m²（'+coverage+'）';
}

export function computedWallAnswer(question:string,sources:CitedEvidence[]) {
  const model=sources.filter((s):s is ModelSource=>s.kind==='model' && !!s.fact);
  if (!model.length) return null;
  const q=wallQuestion(question,model.map(s=>s.fact),sources.map(s=>s.title));
  if (!q || q.unsupported || q.fileOnly || (q.compare && !q.area)) return null;
  const selected=scopedWalls(model,q);
  const ref=(s:CitedEvidence)=>'['+s.id+']';
  const result=(lines:string[])=>({mode:'calculated' as const,answer:lines.join('\n')});
  if (q.levels.length>1 || new Set(selected.map(s=>s.fact.level)).size>1 || new Set(selected.map(s=>s.title)).size>1) {
    return result(['有多个可能的楼层或模型，请指定一个准确的模型和楼层后统计。 '+(selected.length?selected:model).slice(0,3).map(ref).join(' ')]);
  }
  if (!selected.length) {
    return result(['当前提供的模型摘录中没有'+(q.levels[0]?'「'+q.levels[0]+'」':'全模型')+'对应的墙体统计。请核对楼层、模型范围和构件类别。 '+ref(model[0])]);
  }
  const lines:string[]=[];
  if (selected.length>1) lines.push('摘录含多个墙体类别，以下按原类别分别列出。跨类别总数和总面积需要去重后的全部墙类汇总。');
  for (const s of selected) {
    const f=s.fact, prefix=(f.level??'全模型')+' · '+f.category+'：';
    if (q.count) lines.push(prefix+(f.identifiedObjects===f.objects ? '墙体 '+f.objects+' 面（'+f.objects+' 个计量对象，'+f.components+' 条构件记录）'
      : f.objects+' 个计量对象，'+f.components+' 条构件记录。其中 '+(f.objects-f.identifiedObjects)+' 个计量对象缺少可核对的来源标识，无法确认实际墙体数')+'。 '+ref(s));
    if (!q.area) continue;
    const measures=areas(f,q.kind);
    if (!measures.length) lines.push(prefix+'模型未提供'+(q.kind?labelFor(q.kind):'可核对的具名面积')+'及其可用单位。 '+ref(s));
    for (const a of measures.slice(0,4)) lines.push(prefix+areaText(a,f.objects)+'。 '+ref(s));
    if (measures.length>1) lines.push('模型提供多个面积口径，请指定使用哪一项。 '+ref(s));
    if (q.kind && f.source!=='ifc') lines.push('该原始参数没有说明净面积或毛面积，不能确认问题指定的口径。 '+ref(s));
  }
  if (!q.compare) return result(lines);
  const spreadsheets=sources.filter(s=>s.kind!=='model' && /\.(?:xlsx?|csv|tsv)$/iu.test(s.title));
  const cells=spreadsheets.flatMap(s=>tableAreas(s).map(a=>({s,a})));
  const scoped=cells.filter(({a})=>sameTableScope(a.scope,q));
  const totals=scoped.filter(({a})=>a.total);
  const candidates=totals.length?totals:scoped.length?scoped:cells;
  for (const {s,a} of candidates.slice(0,3)) {
    lines.push('表格'+(a.scope?'「'+a.scope+'」':'')+' '+a.address+' '+a.label+'为 '+a.valueText+
      (a.squareMetres?' m²':a.unit?' '+a.unit:'（单位未明确）')+(a.basis?'，口径 '+a.basis:'')+(a.cached?'（公式缓存，未重算）':'')+'。 '+ref(s));
  }
  if (!candidates.length) {
    lines.push('选中的资料片段没有可核对的墙面积数值。请提供包含楼层、墙类别、面积口径、单位和汇总值的工作表。'
      +(spreadsheets.length?' '+spreadsheets.slice(0,2).map(ref).join(' '):''));
    return result(lines);
  }
  const modelSource=selected[0];
  const measures=areas(modelSource.fact,q.kind);
  const {a,s}=candidates[0];
  const sameCategory=sameWallCategory(a.category,modelSource.fact.category);
  const valid=selected.length===1 && measures.length===1 && totals.length===1 && sameCategory
    && (!q.kind || measures[0].basis===q.kind) && a.total && a.squareMetres && a.basis && a.basis===measures[0].basis
    && (!q.levels[0] || floorEquivalent(a.scope,modelSource.fact.level ?? '')) && measures[0].metric.available===modelSource.fact.objects;
  const modelArea=measures[0]?.metric.value;
  if (valid && modelArea!=null) {
    const delta=differenceText(modelArea,a.valueText);
    lines.push('差值（模型 − 表格）为 '+delta+' m²。 '+ref(modelSource)+' '+ref(s));
  } else {
    lines.push('无法确认唯一且同范围、同口径、同单位的完整面积合计。请核对楼层、汇总行、原始参数或净毛面积及数据缺项，再计算差值。 '+ref(modelSource)+' '+ref(s));
  }
  return result(lines);
}
