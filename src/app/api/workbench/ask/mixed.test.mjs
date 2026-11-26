import assert from 'node:assert/strict';
import { createRequire, registerHooks } from 'node:module';
import test from 'node:test';
import { readSpreadsheet } from '../../../../lib/project-spreadsheet.ts';
import { findPassages } from '../../../../lib/project-document-search.ts';
import { computedWallAnswer } from '../../../../lib/project-wall-answer.ts';
import { extractiveAnswer } from '../../../../lib/project-extractive-answer.ts';
import { differenceText } from '../../../../lib/project-wall-table.ts';
import { parseModelFact } from '../../../../lib/project-model-evidence.ts';
import { wallQuestion } from '../../../../lib/project-wall-question.ts';

registerHooks({resolve(specifier,context,next) {
  const mocks={
    '@/lib/supabase/server':'export async function createClient(){return {auth:{getUser:async()=>({data:{user:{id:"qa"}}})}}}',
    '../shares/store.ts':'export async function readShare(){return {documents:globalThis.qaShare}}',
  };
  return specifier in mocks ? {url:'data:text/javascript,'+encodeURIComponent(mocks[specifier]),shortCircuit:true} : next(specifier,context);
}});
const {POST}=await import('./route.ts');
const url='https://qa.invalid/api/workbench/ask';
const request=body=>new Request(url,{method:'POST',headers:{origin:'https://qa.invalid','content-type':'application/json'},body:JSON.stringify(body)});
const counts=(objects)=>({value:null,available:0,missing:0,unavailable:objects,invalid:0,overflow:false});
function fact(level,value,objects=4,category='墙') {
  const empty=counts(objects);
  return {scope:level?'level-category':'category',level,category,source:'revit-parameters',components:objects+2,objects,identifiedObjects:objects,
    metrics:{area:{...empty,unit:'m2',available:objects,unavailable:0,value},length:{...empty,unit:'m'},volume:{...empty,unit:'m3'}}};
}
const model=(facts)=>({kind:'model',title:'结构模型.zip',passages:facts.map(f=>({location:(f.level||'全楼')+' · '+f.category,text:'模型导出的构件及原始量统计',fact:f}))});
async function workbook(rows) {
  const xlsx=createRequire(import.meta.url)('xlsx');
  const book=xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(book,xlsx.utils.aoa_to_sheet([['楼层','类别','计量口径','面积（m²）'],...rows]),'墙体面积汇总');
  const data=xlsx.write(book,{bookType:'xlsx',type:'buffer'});
  return {title:'现行工程量.xlsx',passages:await readSpreadsheet(new File([new Uint8Array(data)],'现行工程量.xlsx'))};
}
const q='二层有多少面墙，墙的面积是多少？和上传的工程量表相差多少？';
const documents=[model([fact(null,199),fact('一层',81.15),fact('二层',117.85)]),
  await workbook([['一层','墙','HOST_AREA_COMPUTED',82],['二层','墙','HOST_AREA_COMPUTED',115.62]])];

test('local and shared asks calculate the same definite wall answer without credentials or provider calls',async()=>{
  delete process.env.DASHSCOPE_API_KEY; delete process.env.GEMINI_API_KEY;
  globalThis.qaShare=documents;
  const sources=findPassages(documents,q);
  assert.equal(sources[0].fact.level,'二层');
  const row=sources.find(s=>s.title.endsWith('.xlsx') && s.text.includes('115.62'));
  assert.equal(row.location,'工作表「墙体面积汇总」!A3:D3');
  for(const body of [{documents:sources},{shareId:'sample'}]){
    const response=await POST(request({question:q,...body}));
    assert.equal(response.status,200);
    const answer=await response.json();
    assert.equal(answer.mode,'calculated');assert.match(answer.answer,/墙体 4 面（4 个计量对象，6 条构件记录）/u);
    assert.match(answer.answer,/117\.85 m²/);assert.match(answer.answer,/115\.62 m²/);assert.match(answer.answer,/差值（模型 − 表格）为 2\.23 m²/u);
    assert.ok(answer.answer.includes('['+sources[0].id+']') && answer.answer.includes('['+row.id+']'));
  }
});

test('missing quantities, incomplete coverage, ambiguous totals and incompatible areas never become a numeric difference',async()=>{
  const partial=fact('二层',76.1);
  Object.assign(partial.metrics.area,{available:2,missing:1,invalid:1});
  const text=docs=>computedWallAnswer(q,findPassages(docs,q)).answer;
  assert.match(text([model([partial]),documents[1]]),/部分合计 76\.1 m².*缺失 1，无效 1/u);
  assert.doesNotMatch(text([model([partial]),documents[1]]),/差值（模型/u);
  const empty=fact('二层',0);Object.assign(empty.metrics.area,{available:0,missing:4,value:null});
  assert.match(text([model([empty]),documents[1]]),/没有可用合计/u);
  const zero=fact('二层',0);assert.match(text([model([zero]),documents[1]]),/差值（模型 − 表格）为 -115\.62 m²/u);
  assert.doesNotMatch(text([documents[0],await workbook([['二层','墙','净侧面积',100]])]),/差值（模型/u);
  assert.doesNotMatch(text([documents[0],await workbook([['二层','墙','HOST_AREA_COMPUTED 扣除洞口',100]])]),/差值（模型/u);
  assert.doesNotMatch(text([documents[0],await workbook([['二层','墙','HOST_AREA_COMPUTED',20],['二层','墙','HOST_AREA_COMPUTED',100]])]),/差值（模型/u);
  const metres=await workbook([['二层','墙','HOST_AREA_COMPUTED',100]]);
  metres.passages=metres.passages.map(p=>({...p,text:p.text.replaceAll('m²','cm²')}));
  assert.doesNotMatch(text([documents[0],metres]),/差值（模型/u);
  assert.equal(differenceText(0.3,'0.20'),'0.1');
});

test('scope matching, several IFC wall classes and named measures',()=>{
  const query='2F 墙有多少面？面积是多少？';
  const IFC=(category,objects)=>{const f=fact('二层',3,objects,category);f.source='ifc';
    f.ifcQuantities=['NetSideArea','GrossSideArea'].map((name,i)=>({...f.metrics.area,metric:'area',group:'Qto_WallBaseQuantities',name,value:i+20}));return f;};
  const a=IFC('IfcWall',3),b=IFC('IfcWallStandardCase',5);
  const multi=[model([a,b])];
  assert.match(computedWallAnswer(query,findPassages(multi,query)).answer,/跨类别总数.*全部墙类汇总/u);
  const both=[model([a,b,IFC('墙体（全部墙类）',8)])];
  const answer=computedWallAnswer(query,findPassages(both,query)).answer;
  assert.match(answer,/墙体 8 面/u);assert.match(answer,/净侧面积.*20 m²/u);assert.match(answer,/毛侧面积.*21 m²/u);
  assert.doesNotMatch(answer,/41 m²/);
  const different='地下二层墙面积是多少？';
  assert.doesNotMatch(computedWallAnswer(different,findPassages(documents,different)).answer,/117\.85/);
  for(const extra of ['二层外墙面积是多少？','二层办公室墙数量是多少？','二层墙面积为什么不足？'])
    assert.equal(computedWallAnswer(extra,findPassages(documents,extra)),null);
  assert.equal(wallQuestion('十一层墙面积是多少？',[fact('一层',2)]).levels[0],'十一层');
});

test('ordinary documents cannot turn strings and even copied fact fields into model sources; invalid explicit facts rejected',async()=>{
  const copied={...documents[0],kind:undefined};
  const found=findPassages([copied],q);
  assert.ok(found.every(s=>!s.kind && !s.fact));assert.equal(computedWallAnswer(q,found),null);
  const wrong=fact('二层',2);wrong.metrics.area.unit='cm2';
  assert.equal(parseModelFact(wrong),null);
  const unassigned={...fact('二层',2),level:''};
  assert.equal(parseModelFact(unassigned)?.level,'');
  const resp=await POST(request({question:q,documents:[{id:'S1',kind:'model',title:'模型',location:'二层',text:'内容',fact:wrong}]}));
  assert.equal(resp.status,400);
});

test('document questions, construction methods, height and floor breakdowns cannot produce a whole-model wall total',()=>{
  const pdf={title:'交底图纸.pdf',passages:[{location:'第 2 页',text:'图纸中二层墙面积标注为 245 m²。'}]};
  const docs=[...documents,pdf];
  for (const query of ['图纸中墙面积是多少？','文件中的墙有几面？','图纸和清单中的墙面积相差多少？','现行工程量.xlsx 中的墙面积是多少？']) {
    const cited=findPassages(docs,query);
    assert.ok(cited.length,query);
    assert.ok(cited.every(s=>s.kind!=='model'),query);
    assert.equal(computedWallAnswer(query,cited),null,query);
  }
  for(const query of ['墙体做法和面积计算规则是什么？','二层墙的层高和面积是多少？','各楼层分别有多少墙以及面积？',
    '请概述墙体做法','墙体的数量和防火等级是什么？','模型中二层墙面积和图纸标注的面积相差多少？']) {
    assert.equal(computedWallAnswer(query,findPassages(docs,query)),null,query);
  }
  const area='模型中二层墙面积有多少个平方？';
  const positive=computedWallAnswer(area,findPassages(docs,area)).answer;
  assert.match(positive,/117\.85 m²/u);assert.doesNotMatch(positive,/墙体 4 面/u);
});

test('area difference needs the same actual wall class, even when no class was named in the question',async()=>{
  const union=fact('二层',127,4,'墙体（全部墙类）');
  const sheet=await workbook([['二层','IfcWallStandardCase','HOST_AREA_COMPUTED',126]]);
  assert.doesNotMatch(computedWallAnswer(q,findPassages([model([union]),sheet],q)).answer,/差值（模型/u);
});

test('unavailable provider yields verified text and corresponding floor and category on direct and shared asks',async()=>{
  const ask='二层墙体交底的验收编码是什么？请同时写出模型中二层相应的构件类别，分别引用交底记录和模型。';
  const docs=[...documents,{title:'二层交底记录.txt',passages:[{location:'第 1 段',text:'二层墙体交底记录。验收编码为 MX-8463，由周工签收。明天施工。'}]},
    {title:'一层交底记录.txt',passages:[{location:'第 1 段',text:'验收编码为 WR-0030。'}]}];
  const cited=findPassages(docs,ask);
  const m=cited.find(s=>s.fact?.level==='二层' && s.fact?.category==='墙');
  const memo=cited.find(s=>s.title==='二层交底记录.txt');
  assert.ok(m && memo);
  const previous=process.env.DASHSCOPE_API_KEY,fetch=globalThis.fetch;
  try {
    process.env.DASHSCOPE_API_KEY='mock';
    globalThis.fetch=async()=>new Response('',{status:429});
    globalThis.qaShare=docs;
    for (const body of [{documents:cited},{shareId:'offline-test'}]) {
      const response=await POST(request({question:ask,...body})); assert.equal(response.status,200);
      const answer=await response.json(); assert.equal(answer.mode,'extractive');assert.match(answer.answer,/MX-8463/u);
      assert.ok(answer.answer.includes('二层 · 墙') && answer.answer.includes('['+m.id+']') && answer.answer.includes('['+memo.id+']'));
      assert.doesNotMatch(answer.answer,/WR-0030|明天施工/u);
    }
    assert.equal(extractiveAnswer('窗框验收编号是什么？',cited),null);
    assert.equal(extractiveAnswer('窗框验收编码是什么？',cited),null);
  } finally {
    globalThis.fetch=fetch;
    if (previous===undefined) delete process.env.DASHSCOPE_API_KEY; else process.env.DASHSCOPE_API_KEY=previous;
  }
});
