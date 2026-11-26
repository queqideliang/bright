import { archiveHeaders, archiveModel, archiveRequest } from "../../../lib/archive-model.ts";
import { retiredReview } from "../../../lib/legacy-model-routes.ts";

export async function GET(request: Request) {
  const access = await archiveModel(new URL(request.url).searchParams.get("modelId"));
  if (access.failure) return access.failure;
  const { model } = access;
  return Response.json(model.audit_json ? { status: "completed", report: model.audit_json } : {
    status: "no_report", archived: true, modelStatus: model.status, workbenchUrl: "/workbench",
  }, archiveHeaders);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const access = await archiveModel(body?.modelId);
  if (access.failure) return access.failure;
  const { client, model } = access;
  const fileName = typeof body.fileName === "string" && body.fileName ? body.fileName : model.name;
  try {
    const checked = await archiveRequest("report", model.id, fileName);
    let report = checked?.ok ? await checked.json() : null;
    if (!report && model.audit_json) return Response.json({ status: "completed", report: model.audit_json }, archiveHeaders);
    if (!report && checked) {
      const summary = await archiveRequest("summary", model.id);
      if (summary?.ok) report = generateBasicReport(fileName, await summary.json());
      else if (checked.status !== 404 || (summary && summary.status !== 404)) {
        return Response.json({ error: "历史审核服务暂时不可用" }, { status: 503 });
      }
    }
    if (!report) return retiredReview();
    const { error } = await client.from("models").update({ audit_json: report, status: "COMPLETED", progress: 100 }).eq("id", model.id);
    if (error) return Response.json({ error: "保存审核报告失败" }, { status: 500 });
    return Response.json({ status: "completed", report }, archiveHeaders);
  } catch {
    if (model.audit_json) return Response.json({ status: "completed", report: model.audit_json }, archiveHeaders);
    return Response.json({ error: "历史审核服务暂时不可用" }, { status: 503 });
  }
}

interface SummaryData {
  total_elements?: number;
  category_stats?: Record<string, number>;
  levels?: Array<{ name: string }>;
}

function generateBasicReport(fileName: string, summaryData: SummaryData) {
  const totalElements = summaryData?.total_elements || 0;
  const issues: Array<{
    id: string;
    category: string;
    severity: string;
    elementId: string;
    elementType: string;
    message: string;
    field: string;
    currentValue?: string;
    expectedFormat?: string;
  }> = [];

  // 对文件名做基础命名检查
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, "");
  const segments = nameWithoutExt.split("-");

  if (segments.length < 7) {
    issues.push({
      id: `naming-segments-${nameWithoutExt}`,
      category: "NAMING",
      severity: "ERROR",
      elementId: nameWithoutExt,
      elementType: "File",
      message: `File name must contain 7 hyphen-separated fields per UK NA. Currently has ${segments.length} segments.`,
      field: "segment_count",
      currentValue: String(segments.length),
      expectedFormat: "Project-Originator-Volume-Level-Type-Role-Number",
    });
  }

  // NOTE: 深度的构件级 Uniclass 和 EIR 检查需要 VPS /compliance-check 端点
  // 这里只能生成文件级的基础检查报告
  const totalErrors = issues.filter((i) => i.severity === "ERROR").length;
  const totalWarnings = issues.filter((i) => i.severity === "WARNING").length;

  // 统一的评分计算（扣分制：score = max(0, 100 - errors×10 - warnings×1)）
  const complianceScore = Math.max(0, 100 - totalErrors * 10 - totalWarnings * 1);

  return {
    checkedAt: new Date().toISOString(),
    modelName: fileName,
    totalElements,
    complianceScore,
    summary: {
      naming: { total: issues.filter((i) => i.category === "NAMING").length, errors: totalErrors, warnings: totalWarnings, passed: 0 },
      uniclass: { total: 0, errors: 0, warnings: 0, passed: 0 },
      eir: { total: 0, errors: 0, warnings: 0, passed: 0 },
    },
    issues,
    _note: "This report checks the archived file name. Element-level checks require the complete model archive.",
  };
}
