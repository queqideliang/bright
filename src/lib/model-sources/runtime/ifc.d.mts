import type { EvidenceModel } from './evidence.mjs';
export function parseIfc(bytes: Uint8Array, name: string, options: {
  metadataOnly: true; limits: { fileBytes: number; products: number; lines: number; propertyValues: number; propertyTextBytes: number };
}): Promise<EvidenceModel>;
