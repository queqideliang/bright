// ================================================================
//  API Route: /api/import-status/[jobId]
//  鉴权 → 转发到 VPS /import-status/{jobId} → 返回状态
//  NOTE: 前端每 3 秒轮询此接口检查 Speckle 导入进度
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VPS_URL = process.env.NEXT_PUBLIC_VPS_API_URL;
const VPS_SECRET_TOKEN = process.env.VPS_SECRET_TOKEN;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  // 鉴权
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;
  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  try {
    const vpsResp = await fetch(`${VPS_URL}/import-status/${jobId}`, {
      headers: {
        "X-VPS-Token": VPS_SECRET_TOKEN ?? "",
      },
    });

    if (!vpsResp.ok) {
      const errText = await vpsResp.text();
      return NextResponse.json(
        { error: errText },
        { status: vpsResp.status },
      );
    }

    const data = await vpsResp.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error("[import-status] VPS 网络异常:", e);
    return NextResponse.json(
      { error: "VPS 服务不可达" },
      { status: 502 },
    );
  }
}
