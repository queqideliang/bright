const units = { length: 'm', area: 'm2', volume: 'm3' } as const;
export type MetricKey = keyof typeof units;
export interface ModelMetric {
  unit: 'm' | 'm2' | 'm3'; value: number | null; available: number; missing: number;
  invalid: number; unavailable: number; overflow: boolean;
}
export interface ModelFact {
  scope: 'model' | 'category' | 'level' | 'level-category';
  category: string | null; level: string | null;
  components: number; objects: number; identifiedObjects: number;
  source: 'revit-parameters' | 'model-records' | 'ifc';
  metrics: Record<MetricKey, ModelMetric>;
  ifcQuantities?: (ModelMetric & {group:string; name:string; metric:MetricKey})[];
}
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const label = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 240;

function metric(v: unknown, unit: ModelMetric['unit'], objects: number): ModelMetric | null {
  if (!record(v) || v.unit !== unit || !count(v.available) || !count(v.invalid) || !count(v.unavailable)
    || !count(v.missing) || typeof v.overflow !== 'boolean' || v.available + v.missing + v.invalid + v.unavailable !== objects) return null;
  if (v.value !== null && (typeof v.value !== 'number' || !Number.isFinite(v.value) || v.value < 0)) return null;
  if ((v.value === null) !== (v.available === 0 || v.overflow)) return null;
  return {unit,value:v.value,available:v.available,missing:v.missing,invalid:v.invalid,unavailable:v.unavailable,overflow:v.overflow};
}

export function parseModelFact(v: unknown): ModelFact | null {
  if (!record(v) || !record(v.metrics) || !count(v.components) || !count(v.objects) || !count(v.identifiedObjects)
    || v.identifiedObjects > v.objects || v.objects > v.components) return null;
  const { scope, category, level, source } = v;
  if (source !== 'revit-parameters' && source !== 'ifc' && source !== 'model-records') return null;
  if (scope !== 'model' && scope !== 'category' && scope !== 'level' && scope !== 'level-category') return null;
  // The extractor uses an empty name for a real unassigned group, and null for an unrestricted dimension.
  if (category !== null && category !== '' && !label(category) || level !== null && level !== '' && !label(level)) return null;
  if ((category !== null) !== (scope === 'category' || scope === 'level-category')
    || (level !== null) !== (scope === 'level' || scope === 'level-category')) return null;
  const metrics = {} as Record<MetricKey, ModelMetric>;
  for (const key of ['length','area','volume'] as const) {
    const parsed = metric(v.metrics[key], units[key], v.objects);
    if (!parsed) return null;
    metrics[key] = parsed;
  }
  let ifcQuantities: ModelFact['ifcQuantities'];
  if (v.ifcQuantities !== undefined) {
    if (source !== 'ifc' || !Array.isArray(v.ifcQuantities) || v.ifcQuantities.length > 64) return null;
    ifcQuantities = [];
    for (const item of v.ifcQuantities) {
      if (!record(item) || !label(item.group) || !label(item.name)
        || (item.metric !== 'length' && item.metric !== 'area' && item.metric !== 'volume')) return null;
      const parsed = metric(item,units[item.metric],v.objects);
      if (!parsed) return null;
      ifcQuantities.push({...parsed,group:item.group,name:item.name,metric:item.metric});
    }
  }
  return {scope, category, level, components:v.components, objects:v.objects, identifiedObjects:v.identifiedObjects,source,metrics,
    ...(ifcQuantities?.length ? {ifcQuantities} : {})};
}
