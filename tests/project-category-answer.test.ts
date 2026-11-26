import assert from 'node:assert/strict';
import test from 'node:test';
import { categoryCountSources, computedCategoryAnswer } from '../src/lib/project-category-answer.ts';
import type { CitedEvidence } from '../src/lib/project-document-search.ts';
import type { ModelFact, ModelMetric } from '../src/lib/project-model-evidence.ts';

function source(id: string, level: string | null, category: string | null, n: number) {
  const amount = (unit: ModelMetric['unit']):ModelMetric => ({ unit, value:null, available:0, missing:n, invalid:0, unavailable:0, overflow:false });
  const fact:ModelFact = {
    scope: level ? (category ? 'level-category' : 'level') : (category ? 'category' : 'model'), level, category,
    components:n+1, objects:n, identifiedObjects:n, source:'ifc',
    metrics:{ length:amount('m'), area:amount('m2'), volume:amount('m3') },
  };
  return {kind:'model' as const, title:'模型 A', id, location:'模型统计', text:'合成统计', fact};
}
const rows = [source('S1',null,'IfcDoor',11),source('S2','Level 2','IfcDoor',3),
  source('S3','1F','IfcDoor',7),source('S4',null,'结构柱',6),source('S5',null,null,79),
  source('S6','屋面','IfcDoor',1)];

test('routes a simple count to the exact floor/category, cites only that source, and distinguishes records from objects', () => {
  assert.deepEqual(categoryCountSources('二层有多少扇门？', rows).map(row=>row.id), ['S2']);
  const second = computedCategoryAnswer('二层有多少扇门？',rows)!;
  assert.equal(second.mode,'calculated');
  assert.match(second.answer,/3 个去重计量对象.*4 条构件记录.*\[S2\]/u);
  assert.deepEqual(categoryCountSources('屋面有几扇门？',rows).map(row=>row.id), ['S6']);
  assert.match(computedCategoryAnswer('模型里柱子有几个？',rows)!.answer,/6 个去重计量对象.*\[S4\]/u);
  assert.match(computedCategoryAnswer('全模型总构件记录数是多少？',rows)!.answer,/80 条构件记录.*\[S5\]/u);
  assert.match(computedCategoryAnswer('二层门的构件记录数是多少？',rows)!.answer,/4 条构件记录.*\[S2\]/u);
});

test('unknown qualifiers, document references, missing floors, compound tasks and ambiguous categories do not produce a model count', () => {
  for (const q of ['三层有几扇门？','首层和二层有多少扇门？','各层有多少扇门？','二层有多少扇防火门？',
    '地下二层有几扇门？','清单里有几扇门？','模型和资料的门数量一致吗？','门和窗总共有多少个？',
    '二层门数量和面积是多少？','当前筛选有几扇门？','屋面以下有几扇门？','二层有多少面墙？']) {
    assert.equal(computedCategoryAnswer(q,rows),null,q);
  }
  const siblings = [...rows,source('S7',null,'建筑柱',2)];
  assert.deepEqual(categoryCountSources('模型里柱子有几个？',siblings).map(r=>r.id), ['S4','S7']);
  assert.equal(computedCategoryAnswer('模型里柱子有几个？',siblings),null);
  const onlySecond = [source('S1',null,'门',44), source('S2','二层','门',3)];
  for (const q of ['地下二层有几扇门？', '十二层有几扇门？', '二层以上有几扇门？']) {
    assert.deepEqual(categoryCountSources(q,onlySecond),[],q);
    assert.equal(computedCategoryAnswer(q,onlySecond),null,q);
  }
  const peer = {...rows[0]!,id:'S8',title:'模型 B'};
  assert.equal(computedCategoryAnswer('模型里门有几个？',[...rows,peer]),null);
  const noIds:CitedEvidence = source('S9',null,'门',4);
  noIds.fact!.identifiedObjects=0;
  assert.match(computedCategoryAnswer('门有几个？',[noIds])!.answer,/缺少来源标识.*无法核实.*\[S9\]/u);
});
