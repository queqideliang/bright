export interface ComponentRecord {
  id: string; name: string; category: string; levelNames: string[];
  quantitySnapshot?: unknown; quantityIssue?: string;
}
export interface EvidenceDocument {
  kind: 'model';
  title: string;
  passages: { location: string; text: string; fact?: unknown }[];
}
export interface EvidenceModel {
  name: string; components: ComponentRecord[]; source?: Record<string, unknown>;
}
interface Entry { name: string; originalSize: number }
export class ModelArchive {
  constructor(bytes: Uint8Array, limits: { compressedBytes: number; uncompressedBytes: number; entryBytes: number; entries: number; memoryBytes: number; heapBytes: number });
  inspect(): Promise<Entry[]>;
  chunks(entry: Entry): AsyncIterable<Uint8Array>;
}
export function jsonRecords(chunks: AsyncIterable<Uint8Array>, array: boolean, path: string,
  options: { maxRecordCharacters: number }): AsyncIterable<[string, unknown]>;
export function parseQuantitySnapshot(value: unknown): { snapshot?: unknown; issue?: string };
export function buildModelQaDocument(model: EvidenceModel, options?: { signal?: AbortSignal }): Promise<EvidenceDocument>;
