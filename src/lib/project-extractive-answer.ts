import { namedModelScopes, type CitedEvidence } from './project-document-search.ts';
import type { ModelFact } from './project-model-evidence.ts';
import { floorEquivalent, floorTokens } from './project-wall-question.ts';

const noise = /按要求|请同时|请问|请列出|请说明|请提供|请给出|请指出|是什么|是什么样|有哪些|是多少|有什么|怎样|如何|是否|哪些|提到|记录了|分别引用|并列出|中的|里面|对于|有关|相关|需要|文件|项目|资料|图纸|模型|构件|工作表|表格|本文|原文|以下|说明|要求|规定|请|的|和|及|中|里|为|对|有|在|是/gu;
const generic = new Set(['墙体','楼层','类别','交底','记录','工程','现场','本次','概要','问题','进行','多少','部分','汇总','资料','面积']);

function searchTerms(question:string) {
  const q=question.normalize('NFKC').toLowerCase().split(/请同时|同时(?:写出|说明|列出)|分别引用/u)[0];
  const fields=q.match(/(?:验收|交付|构件|材料|设备|节点|工序|台账|批次|图纸|项目)?(?:编码|编号|代号|图号|序号|型号|日期|等级|厚度|强度|做法)/gu) ?? [];
  let content=q;
  for (const level of floorTokens(q)) content=content.replaceAll(level,' ');
  const field=fields[0];
  const beforeField=field ? content.slice(0,content.indexOf(field)) : '';
  const qualifiers=beforeField.replace(noise,' ').replace(/这份|上传|当中|查找|查询|查看|表中|模型中|一下|上述|根据|请从|想知道|我想|麻烦/gu,' ')
    .match(/[a-z0-9][a-z0-9_-]+|[\p{Script=Han}]{2,}/gu) ?? [];
  const terms=new Set<string>();
  for (const chunk of content.replace(noise,' ').match(/[a-z][a-z0-9_-]*|[\p{Script=Han}]+/gu) ?? []) {
    if (chunk.length<2 || generic.has(chunk)) continue;
    terms.add(chunk);
    if (/\p{Script=Han}/u.test(chunk)) {
      for(let i=0;i<chunk.length-1;i++) {
        const pair=chunk.slice(i,i+2); if(!generic.has(pair)) terms.add(pair);
      }
    }
  }
  return {fields,terms,qualifiers};
}

function sentences(text:string) {
  // Keep numeric decimals, literal field labels and their values together.
  return text.split(/(?<=[。！？!?])|\r?\n|\.\s+(?=[A-Z])/u).flatMap(line=>line.length>300?line.split(/[；;，]/u):[line])
    .map(line=>line.trim()).filter(line=>line.length>=3 && line.length<=300 && !/[?？]$/u.test(line));
}

export function extractiveAnswer(question:string,sources:CitedEvidence[]) {
  const {fields,terms,qualifiers}=searchTerms(question);
  if (!terms.size || /(?:相差|差值|比较|比较一下|对比|差多少|推算|为什么|原因|是否合规)/u.test(question)) return null;
  const levels=floorTokens(question);
  const matches=(levelsIn:string[])=>!levels.length || !levelsIn.length || levelsIn.some(l=>levels.some(w=>floorEquivalent(l,w)));
  const excerpts: {source:CitedEvidence;text:string;score:number}[]=[];
  for (const source of sources) {
    if (source.kind==='model' || !matches(floorTokens(source.title+' '+source.location))) continue;
    const lines=sentences(source.text);
    let contextLevels:string[]=[];
    for (const [index,text] of lines.entries()) {
      const lineLevels=floorTokens(text);
      if (lineLevels.length) contextLevels=lineLevels;
      if (!matches(contextLevels)) continue;
      const norm=text.normalize('NFKC').toLowerCase();
      const context=(source.title+' '+source.location+' '+(lines[index-1] ?? '')+' '+norm).normalize('NFKC').toLowerCase();
      if (qualifiers.some(term=>!context.includes(term))) continue;
      if (fields.length && !fields.some(field=>norm.includes(field))) continue;
      if (fields.some(f=>/编码|编号|代号|图号|序号|型号/u.test(f)) && !/[\p{L}\d]+[-_][\p{L}\d]+|\d|(?:为|是|[：:=])\s*[\p{L}]{2,}/u.test(text)) continue;
      const hits=[...terms].filter(term=>norm.includes(term));
      const score=hits.reduce((n,term)=>n+Math.min(term.length,8),0);
      if (score>=3 || (fields.length && score>=2)) excerpts.push({source,text,score});
    }
  }
  const selected=excerpts.sort((a,b)=>b.score-a.score).filter((v,i,all)=>all.findIndex(e=>e.source.id===v.source.id || e.text===v.text)===i).slice(0,2);
  if (!selected.length) return null;
  const lines=['AI 服务暂时无法生成回答。以下摘自本次检索的原文。'];
  for (const {source,text} of selected) lines.push('《'+source.title+'》：“'+text+'” ['+source.id+']');
  if (/模型/u.test(question) && /构件类别|模型类别|类别|分类/u.test(question)) {
    const model=sources.filter((s):s is CitedEvidence & {fact:ModelFact}=>s.kind==='model' && !!s.fact);
    const scopes=namedModelScopes(model,question).slice(0,3);
    if(scopes.length) for(const s of scopes) lines.push('模型摘录中的范围和类别为 '+(s.fact.level ?? '全模型')+' · '+s.fact.category+'。 ['+s.id+']');
    else lines.push('当前模型摘录未提供可核对的对应楼层和类别。');
  }
  return {mode:'extractive' as const,answer:lines.join('\n')};
}
