import { libraryFailure, libraryResponse } from '../../../../../lib/model-library/storage.ts';
import { readModelSource, SourceError } from '../../../../../lib/model-sources/read.ts';

export const runtime = 'nodejs';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(45000)]);
  try {
    const document = await readModelSource(id, signal);
    return libraryResponse({ document });
  } catch (error) {
    if (error instanceof SourceError) return libraryResponse({ error: error.message }, error.status);
    if (signal.aborted) return libraryResponse({ error: '模型资料读取超时或已取消。' }, 504);
    return libraryFailure(error);
  }
}
