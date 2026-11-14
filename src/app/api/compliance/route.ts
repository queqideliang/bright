// ================================================================
//  API Route: /api/compliance — 触发合规检查并获取结果
//  POST: 对指定模型运行合规检查（通过 VPS 或前端预检）
//  GET:  获取已完成的合规检查结果
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VPS_API_URL = process.env.NEXT_PUBLIC_VPS_API_URL;
const VPS_SECRET_TOKEN = process.env.VPS_SECRET_TOKEN;

/**
 * POST — 触发合规检查
 * 优先调用 VPS 的 /compliance-check 端点（IFC 深度解析）
 * 如果 VPS 端点尚未部署，则使用前端已有的模型摘要数据进行基础检查
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { modelId, projectId, fileName } = await request.json();

    if (!modelId) {
      return NextResponse.json({ error: "modelId is required" }, { status: 400 });
    }

    console.log("========== /api/compliance POST ==========");
    console.log("-> userId:", user.id, "modelId:", modelId);

    // 策略一：尝试 VPS 深度合规检查（需要 VPS 部署 /compliance-check）
    try {
      const vpsResp = await fetch(`${VPS_API_URL}/compliance-check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-VPS-Token": VPS_SECRET_TOKEN ?? "",
        },
        body: JSON.stringify({
          model_id: modelId,
          project_id: projectId || "default",
          file_name: fileName || "",
        }),
        signal: AbortSignal.timeout(60000), // 60 秒超时，IFC 解析较慢
      });

      if (vpsResp.ok) {
        const data = await vpsResp.json();
        console.log("✅ VPS 合规检查成功返回");

        // 将结果存入 Supabase models.audit_json
        await supabase
          .from("models")
          .update({
            audit_json: data,
            status: "COMPLETED",
            progress: 100,
          })
          .eq("id", modelId);

        return NextResponse.json({ status: "completed", report: data });
      } else {
        console.log("⚠️ VPS /compliance-check 返回非 200:", vpsResp.status);
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      // VPS 端点尚未部署或不可达，执行前端基础检查
      console.log("❌ VPS /compliance-check 不可用，使用前端基础检查。错误:", errorMessage);
    }

    // 策略二：使用已有摘要数据 + 前端规则引擎做基础检查
    // NOTE: 从 VPS 已提取的摘要数据中获取构件信息
    try {
      const summaryResp = await fetch(`${VPS_API_URL}/project/${modelId}/summary`, {
        headers: {
          "Content-Type": "application/json",
          "X-VPS-Token": VPS_SECRET_TOKEN ?? "",
        },
        signal: AbortSignal.timeout(5000),
      });

      if (summaryResp.ok) {
        const summaryData = await summaryResp.json();

        // 基于摘要数据生成基础合规报告
        const basicReport = generateBasicReport(fileName || "unknown", summaryData);

        // 存储结果
        await supabase
          .from("models")
          .update({
            audit_json: basicReport,
            status: "COMPLETED",
            progress: 100,
          })
          .eq("id", modelId);

        return NextResponse.json({ status: "completed", report: basicReport });
      }
    } catch {
      console.log("⚠️ 无法获取摘要数据");
    }

    // 策略三：都失败了，返回等待状态
    return NextResponse.json({
      status: "pending",
      message: "模型数据尚未就绪，请稍后再试",
    });
  } catch (err) {
    console.error("Compliance API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET — 获取已有的合规检查结果
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get("modelId");

  if (!modelId) {
    return NextResponse.json({ error: "modelId is required" }, { status: 400 });
  }

  // 从数据库读取已存储的合规检查结果
  const { data: model } = await supabase
    .from("models")
    .select("audit_json, status, name")
    .eq("id", modelId)
    .single();

  if (!model) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }

  if (model.audit_json) {
    return NextResponse.json({
      status: "completed",
      report: model.audit_json,
    });
  }

  return NextResponse.json({
    status: model.status === "COMPLETED" ? "no_report" : "pending",
    modelStatus: model.status,
  });
}

// ── 基础报告生成（当 VPS /compliance-check 不可用时的降级方案）──

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
    _note: "This is a basic file-level check. Deploy VPS /compliance-check endpoint for full IFC element-level analysis.",
  };
}
