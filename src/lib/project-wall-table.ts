import { floorEquivalent, isWall, wallUnion, type WallQuestion } from './project-wall-question.ts';

type Source = {title:string;location:string;text:string};
type Cell = {address:string; label:string; value:string};
const areaUnit = /(?:m\s*(?:2|²|\^2)|㎡|平方米|平方公尺|平米)/iu;
const otherUnit = /(?:mm|cm|km|ft)\s*(?:2|²|\^2)|平方(?:毫米|厘米|千米|英尺)|公顷|亩/iu;
const totalLabel = /汇总|总计|小计|合计|总面积|总量|subtotal|total/iu;
const allLevels = /^(全模型|整个模型|全部|全部楼层|全楼层|全楼|全项目|整栋|全栋|合计|总计|all levels|whole model)$/iu;
export function tableAreas(row: Source) {
  if (!/\.(?:xlsx?|csv|tsv)$/iu.test(row.title) || !/^工作表「.+」![A-Z]+\d+(?::[A-Z]+\d+)?$/u.test(row.location) || row.text.startsWith('表头。')) return [];
  const cells: Cell[] = [];
  for (const match of row.text.matchAll(/(?:^|[；。])([A-Z]{1,3}\d+) ([^；=]{1,150})=([^；]+)/gu)) {
    cells.push({ address:match[1],label:match[2].trim(),value:match[3].trim() });
  }
  const field = (pattern: RegExp) => cells.filter(c=>pattern.test(c.label)).map(c=>c.value).join('、');
  const category = field(/^(类别|构件类别|构件类型|分类|专业类别|category)$/iu);
  const scope = field(/^(范围|统计范围|适用范围|楼层|所在楼层|楼层名称|层号|level|scope|floor)$/iu);
  const unit = field(/^(面积单位|计量单位|单位|unit)$/iu);
  const definition = field(/^(口径|计量口径|面积口径|统计口径|计算口径|参数|原始参数|指标|来源参数|参数名|quantity)$/iu);
  const sheet = row.location.slice(4,row.location.indexOf('」!'));
  const wall = category ? isWall(category) : /墙体|墙面|墙面积|walls?/iu.test(sheet) || cells.some(c=>/墙体|墙面积|walls?/iu.test(c.label));
  const detail=cells.some(c=>/构件编号|元素编号|墙体编号|构件标识|element.?id|楼栋|分区|施工段|轴线|墙类型|材质|材料/iu.test(c.label)
    && !/^(全部|所有|合计|总计|汇总|all|total)$/iu.test(c.value));
  const total = !detail && (totalLabel.test(sheet) || cells.some(c=>totalLabel.test(c.label) || totalLabel.test(c.value)));
  if (!wall) return [];
  return cells.flatMap(cell=>{
    if (!/面积|host_area_computed|(?:net|gross)sidearea|\barea\b/iu.test(cell.label) &&
      !(/^(合计|总计|工程量|数值|数量|总量)$/u.test(cell.label) && /面积|host_area_computed|sidearea/iu.test(definition))) return [];
    const raw = cell.value.replace(/^公式缓存值\s+(.+)（未重算）$/u,'$1').trim();
    const valueText = raw.match(/^([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*(?:m²|m2|㎡|平方米)?$/iu)?.[1].replaceAll(',','');
    if (!valueText || !Number.isFinite(Number(valueText)) || Number(valueText)<0) return [];
    const labels=cell.label+' '+definition;
    const definitions=[/host_area_computed/iu.test(labels) && 'HOST_AREA_COMPUTED',/netsidearea|净侧面积/iu.test(labels) && 'NetSideArea',
      /grosssidearea|毛侧面积/iu.test(labels) && 'GrossSideArea'].filter((v): v is string=>typeof v==='string');
    const adjusted = /扣(?:除|减)|折算|双面|两面|投影|门窗|洞口|抹灰|饰面|按定额|adjusted|deduct/iu.test(labels)
      || (definitions.includes('HOST_AREA_COMPUTED') && /净面积|毛面积|\bnet\b|\bgross\b/iu.test(labels));
    const basis = !adjusted && definitions.length===1 ? definitions[0] : '';
    const units = [unit,cell.label,raw].join(' ');
    const squareMetres=areaUnit.test(units) && !otherUnit.test(units) && (!unit || /^(m²|m2|m\^2|㎡|平方米|平米|平方公尺)$/iu.test(unit));
    const tableCategory=category || (/^(?:墙体?|walls?)(?:面积|工程量)(?:汇总|合计|总计)?表?$/iu.test(sheet)?'墙':'');
    return [{address:cell.address,valueText,basis,squareMetres,unit:unit || cell.label.match(/[（(]([^）)]+)[）)]/u)?.[1] || '',scope,total,category:tableCategory,
      label:cell.label, cached:raw!==cell.value}];
  });
}
export function sameWallCategory(table:string,model:string|null) {
  if (!model || !table) return false;
  const generic=(name:string)=>name===wallUnion || /^(墙|墙体|walls?|ost_walls)$/iu.test(name);
  return table.toLowerCase()===model.toLowerCase() || (generic(table) && generic(model));
}
export function sameTableScope(scope: string,q: WallQuestion) {
  if (!scope) return false;
  return q.levels.length === 1 ? floorEquivalent(scope,q.levels[0]) : !q.levels.length && allLevels.test(scope);
}

// Subtract the decimal strings as integers with a common scale; no binary float subtraction.
export function differenceText(left: number, right: string) {
  function parts(raw: string) {
    const [base,exp='0'] = raw.toLowerCase().split('e');
    const [whole, decimal=''] = base.replace(/^\+/,'').split('.');
    return {digits:BigInt(whole+decimal),scale:decimal.length-Number(exp)};
  }
  const a=parts(String(left)),b=parts(right),scale=Math.max(0,a.scale,b.scale);
  const value=a.digits*BigInt(10)**BigInt(scale-a.scale)-b.digits*BigInt(10)**BigInt(scale-b.scale);
  const absolute=String(value<BigInt(0)?-value:value).padStart(scale+1,'0');
  let result=scale ? absolute.slice(0,-scale)+'.'+absolute.slice(-scale) : absolute;
  if(scale) result=result.replace(/0+$/u,'').replace(/\.$/u,'');
  return (value<BigInt(0)?'-':'')+result;
}
