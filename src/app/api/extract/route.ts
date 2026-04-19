// ================================================================
//  API Route: /api/extract — 触发 VPS 提取 BIM 数据
//  检查 VPS 是否已有数据，没有则触发 /extract，已有则返回 ready
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VPS_API_URL = process.env.NEXT_PUBLIC_VPS_API_URL;
const VPS_SECRET_TOKEN = process.env.VPS_SECRET_TOKEN;
const VPS_HEADERS = { "Content-Type": "application/json", "X-VPS-Token": VPS_SECRET_TOKEN ?? "" };

export async function POST(request: NextRequest) {
  // ── 鉴权 ─────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, speckleProjectId, speckleModelId } = await request.json();

  if (!projectId || !speckleProjectId) {
    return NextResponse.json({ error: "projectId and speckleProjectId are required" }, { status: 400 });
  }

  // 先检查 VPS 上是否已有该项目数据
  try {
    const checkResp = await fetch(`${VPS_API_URL}/project/${projectId}/summary`, {
      headers: VPS_HEADERS,
      signal: AbortSignal.timeout(5000),
    });
    if (checkResp.ok) {
      return NextResponse.json({ status: "ready" });
    }
  } catch {
    return NextResponse.json({ status: "error", message: "VPS 暂时不可达" });
  }

  // 没有数据，触发后台提取
  try {
    await fetch(`${VPS_API_URL}/extract`, {
      method: "POST",
      headers: VPS_HEADERS,
      body: JSON.stringify({
        project_id: projectId,
        speckle_project_id: speckleProjectId,
        speckle_model_id: speckleModelId || "all",
      }),
      signal: AbortSignal.timeout(8000),
    });
    return NextResponse.json({ status: "extracting" });
  } catch {
    return NextResponse.json({ status: "error", message: "数据提取启动失败" });
  }
}

// 轮询检查数据是否就绪
export async function GET(request: NextRequest) {
  // ── 鉴权 ─────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  try {
    // 1. 查询数据库中的最新状态（看有没有生成 Speckle ID）
    const { data: model } = await supabase
      .from("models")
      .select("speckle_stream_id, speckle_model_id, status, progress")
      .eq("id", projectId)
      .single();

    // 2. 检查 VPS 摘要数据
    const checkResp = await fetch(`${VPS_API_URL}/project/${projectId}/summary`, {
      headers: VPS_HEADERS,
      signal: AbortSignal.timeout(5000),
    });
    
    let summary = null;
    if (checkResp.ok) {
      summary = await checkResp.json();
    }

    let apiStatus = "extracting";
    if (model?.status === "COMPLETED") apiStatus = "ready";
    else if (model?.status === "FAILED") apiStatus = "error";

    return NextResponse.json({ 
      status: apiStatus,
      progress: model?.progress || 0,
      speckleStreamId: model?.speckle_stream_id,
      speckleModelId: model?.speckle_model_id,
      summary 
    });
  } catch (err) {
    console.error("Extract poll error:", err);
    return NextResponse.json({ status: "error" });
  }
}
