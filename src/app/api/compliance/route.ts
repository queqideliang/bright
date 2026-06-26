// ================================================================
//  API Route: /api/compliance — 触发合规检查并获取结果
//  POST: 对指定模型运行合规检查（通过 VPS 或前端预检）
//  GET:  获取已完成的合规检查结果
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VPS_API_URL = process.env.NEXT_PUBLIC_VPS_API_URL;
const VPS_SECRET_TOKEN = process.env.VPS_SECRET_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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

/**
 * POST — 为合规问题生成 AI 修复建议
 */
export async function generateFixSuggestions(
  issues: Array<{
    elementId: string;
    elementType: string;
    message: string;
    field: string;
    currentValue?: string;
    expectedFormat?: string;
  }>,
): Promise<string[]> {
  if (!GEMINI_API_KEY || issues.length === 0) return [];

  // 将错误列表压缩为简洁的上下文
  const issuesSummary = issues.slice(0, 20).map((issue, i) =>
    `${i + 1}. [${issue.elementType}] ID: ${issue.elementId} | 错误: ${issue.message} | 字段: ${issue.field}${issue.currentValue ? ` | 当前值: ${issue.currentValue}` : ""}${issue.expectedFormat ? ` | 期望: ${issue.expectedFormat}` : ""}`,
  ).join("\n");

  const systemPrompt = `你是一名专业的 BIM 信息经理（ISO 19650 认证）。
以下是模型合规检查中发现的错误列表。
请为每条错误生成一段简短（2-3 句话）的修复步骤说明。
要求：
1. 用英语回答
2. 面向 Revit 初级建模员，说清楚在 Revit 中具体怎么操作
3. 如果是命名问题，说明正确的命名格式
4. 每条建议用编号对应输入的错误编号
5. 不要重复错误描述，只给操作步骤`;

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: issuesSummary }] }],
        }),
      },
    );

    if (!resp.ok) return [];

    const result = await resp.json();
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    // 按编号分割
    return text.split(/\n(?=\d+\.)/).map((s: string) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
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

  return {
    checkedAt: new Date().toISOString(),
    modelName: fileName,
    totalElements,
    complianceScore: totalErrors === 0 ? 100 : Math.max(0, Math.round(((1 - totalErrors / Math.max(totalElements, 1)) * 100))),
    summary: {
      naming: { total: issues.filter((i) => i.category === "NAMING").length, errors: totalErrors, warnings: totalWarnings, passed: 0 },
      uniclass: { total: 0, errors: 0, warnings: 0, passed: 0 },
      eir: { total: 0, errors: 0, warnings: 0, passed: 0 },
    },
    issues,
    _note: "This is a basic file-level check. Deploy VPS /compliance-check endpoint for full IFC element-level analysis.",
  };
}
