import { archiveHeaders, archiveModel, archiveRequest } from "../../../lib/archive-model.ts";
import { retiredReview } from "../../../lib/legacy-model-routes.ts";

async function archivedExtraction(id: unknown, readStatus: boolean) {
  const access = await archiveModel(id);
  if (access.failure) return access.failure;
  const { model } = access;
  try {
    const response = await archiveRequest("summary", model.id);
    const summary = response?.ok ? await response.json() : null;
    if (response && !response.ok && response.status !== 404) {
      return Response.json({ error: "历史模型摘要暂时不可用" }, { status: 503 });
    }
    if (!readStatus) return summary ? Response.json({ status: "ready" }, archiveHeaders) : retiredReview();
    const status = summary || model.status === "COMPLETED" ? "ready" : model.status === "FAILED" ? "error" : "archived";
    return Response.json({
      status, progress: model.progress ?? 0, summary,
      speckleStreamId: model.speckle_stream_id, speckleModelId: model.speckle_model_id,
    }, archiveHeaders);
  } catch {
    return Response.json({ error: "历史模型摘要暂时不可用" }, { status: 503 });
  }
}

export async function GET(request: Request) {
  return archivedExtraction(new URL(request.url).searchParams.get("projectId"), true);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  return archivedExtraction(body?.projectId, false);
}
