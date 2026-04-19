// ================================================================
//  API Route: /api/chat — AI 审计问答
//  通过 VPS Worker 或直接调用 Gemini API 处理 BIM 审计问题
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VPS_API_URL = process.env.NEXT_PUBLIC_VPS_API_URL;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const VPS_SECRET_TOKEN = process.env.VPS_SECRET_TOKEN;

export async function POST(request: NextRequest) {
  // ── 鉴权 ─────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { question, projectId, modelId, modelData } = body;

    console.log("========== /api/chat ==========");
    console.log("-> userId:", user.id, "projectId:", projectId);

    if (!question) {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }

    // 策略：优先尝试 VPS Worker（有完整 BIM 数据），失败时 fallback 到直接 Gemini
    try {
      const vpsResp = await fetch(`${VPS_API_URL}/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-VPS-Token": VPS_SECRET_TOKEN ?? "" },
        body: JSON.stringify({
          project_id: projectId || "default",
          model_id: modelId || null,
          question,
          context_json: modelData || null,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (vpsResp.ok) {
        const data = await vpsResp.json();
        console.log("✅ VPS 成功返回 AI 解析！");
        return NextResponse.json({ answer: data.answer, source: "vps" });
      } else {
        console.log("⚠️ VPS API 返回状态非 200，状态码：", vpsResp.status);
      }
    } catch (e: any) {
      // VPS 不可用，fallback 到直接 Gemini
      console.log("❌ 访问 VPS Worker 失败，即将 Fallback 到直接调用 Gemini 接口。错误信息:", e.message);
    }

    // Fallback: 直接调用 Gemini API
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
    }

    const systemPrompt = `你是一个专业的 BIM 审计助手（亮阳 BIM·AI 平台）。
你正在分析一个建筑信息模型。请根据 BIM 行业知识回答用户的问题。
回答要简洁专业，使用 BIM 行业术语。可以用 emoji 标注重要信息。
${modelData ? `\n以下是当前模型的部分构件数据：\n${typeof modelData === "string" ? modelData.slice(0, 6000) : JSON.stringify(modelData).slice(0, 6000)}` : ""}`;

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: question }] }],
        }),
      }
    );

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      console.error("Gemini API error:", errText);
      return NextResponse.json({ error: "AI call failed" }, { status: 500 });
    }

    const result = await geminiResp.json();
    const answer = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? "无法生成回答";

    return NextResponse.json({ answer, source: "gemini" });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
