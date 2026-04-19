// ================================================================
//  API Route: /api/upload-to-speckle
//  鉴权 → 创建项目记录 → 转发 FormData 到 VPS /upload-to-speckle
//  NOTE: 此路由作为前端与 VPS 之间的鉴权代理
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ALL_FORMATS, EXT_TO_FORMAT, MAX_FILE_SIZE } from "@/lib/supported-formats";

const VPS_URL = process.env.NEXT_PUBLIC_VPS_API_URL;
const VPS_SECRET_TOKEN = process.env.VPS_SECRET_TOKEN;

export async function POST(request: NextRequest) {
  // ── 1. 鉴权 ──────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. 解析 multipart ────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err: any) {
    console.error("❌ request.formData() 解析彻底崩溃，异常详情:", err?.message || err);
    return NextResponse.json({ error: `[表单解析异常] ${err?.message || "Invalid form data"}` }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const projectName = (formData.get("projectName") as string | null)?.trim();

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // ── 3. 服务端校验 ─────────────────────────────────────────────
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `文件大于 50MB，暂时不支持大文件上传。（当前 ${(file.size / 1024 / 1024).toFixed(1)} MB）` },
      { status: 400 },
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALL_FORMATS.includes(ext)) {
    return NextResponse.json(
      { error: `不支持的文件格式 .${ext}` },
      { status: 400 },
    );
  }

  const format = EXT_TO_FORMAT[ext] ?? ext.toUpperCase();
  const name = projectName || file.name.replace(/\.[^.]+$/, "");

  // ── 4. 创建 Supabase 项目记录 ────────────────────────────────
  const { data: project, error: projErr } = await supabase
    .from("projects")
    .insert({ user_id: user.id, name })
    .select("id")
    .single();

  if (projErr || !project) {
    console.error("创建项目失败:", projErr);
    return NextResponse.json(
      { error: `创建项目失败: ${projErr?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  // ── 5. 构造 FormData 转发到 VPS ──────────────────────────────
  const vpsFormData = new FormData();
  // 转换 File 为 Blob，防止 Next.js 中 Node.js fetch 丢失 FormData 中的文件流
  const fileBuf = await file.arrayBuffer();
  vpsFormData.append("file", new Blob([fileBuf], { type: file.type }), file.name);
  vpsFormData.append("project_id", project.id);
  vpsFormData.append("model_name", name);
  vpsFormData.append("user_id", user.id);

  try {
    const vpsResp = await fetch(`${VPS_URL}/upload-to-speckle`, {
      method: "POST",
      headers: {
        "X-VPS-Token": VPS_SECRET_TOKEN ?? "",
      },
      body: vpsFormData,
    });

    if (!vpsResp.ok) {
      const errText = await vpsResp.text();
      console.error(`[upload-to-speckle] VPS 响应 ${vpsResp.status}:`, errText);
      // 🔥 由于 VPS 处理失败，将提前建好的项目外壳及可能生成的关联模型删掉，防止前台产生一堆异常的 Pending 数据
      const { createAdminClient } = await import("@/lib/supabase/server");
      const adminClient = createAdminClient();
      await adminClient.from("models").delete().eq("project_id", project.id);
      await adminClient.from("projects").delete().eq("id", project.id);
      return NextResponse.json(
        { error: `VPS 处理失败: ${errText}` },
        { status: vpsResp.status >= 500 ? 502 : vpsResp.status },
      );
    }

    const result = await vpsResp.json();

    return NextResponse.json({
      success: true,
      projectId: project.id,
      modelId: result.model_id,
      importJobId: result.import_job_id,
      speckleModelId: result.speckle_model_id,
      name,
      format,
      status: result.status,
    });
  } catch (e) {
    console.error("[upload-to-speckle] VPS 网络异常:", e);
    // 🔥 清理网络异常建好的外壳项目及可能生成的关联模型
    const { createAdminClient } = await import("@/lib/supabase/server");
    const adminClient = createAdminClient();
    await adminClient.from("models").delete().eq("project_id", project.id);
    await adminClient.from("projects").delete().eq("id", project.id);
    return NextResponse.json(
      { error: "VPS 服务不可达，请稍后重试" },
      { status: 502 },
    );
  }
}
