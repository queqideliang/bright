// ================================================================
//  API Route: /api/upload-complete
//  浏览器直传 Supabase Storage 完成后调用
//  创建 DB 记录 → 触发 VPS 解析
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const VPS_URL = process.env.NEXT_PUBLIC_VPS_API_URL;
const VPS_SECRET_TOKEN = process.env.VPS_SECRET_TOKEN;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { storagePath, fileName, format, projectName } = await request.json();
  if (!storagePath || !fileName || !format) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const name = projectName?.trim() || fileName.replace(/\.[^.]+$/, "");

  // 创建项目记录
  const { data: project, error: projErr } = await supabase
    .from("projects")
    .insert({ user_id: user.id, name })
    .select("id")
    .single();

  if (projErr || !project) {
    console.error("创建项目失败:", projErr);
    return NextResponse.json({ error: `创建项目失败: ${projErr?.message ?? "unknown"}` }, { status: 500 });
  }

  // 创建模型记录
  const { data: model, error: modelErr } = await supabase
    .from("models")
    .insert({
      project_id: project.id,
      name: fileName,
      file_type: format,
      status: "PARSING",
      progress: 5,
      element_count: 0,
    })
    .select("id")
    .single();

  if (modelErr || !model) {
    console.error("创建模型记录失败:", modelErr);
    return NextResponse.json({ error: `创建模型记录失败: ${modelErr?.message ?? "unknown"}` }, { status: 500 });
  }

  // 生成签名下载 URL 供 VPS 使用（1 小时有效）
  const admin = createAdminClient();
  console.log(`[API /upload-complete] 请求生成签名链接: storagePath = ${storagePath}`);
  const { data: signedUrl, error: signedUrlError } = await admin.storage
    .from("bim-models")
    .createSignedUrl(storagePath, 3600);

  if (signedUrlError || !signedUrl?.signedUrl) {
    console.error("[API /upload-complete] 获取签名 URL 失败:", signedUrlError);
  } else {
    console.log(`[API /upload-complete] 成功获取签名 URL! 准备提交 VPS...`);
    try {
      const payload = {
        model_id: model.id,
        project_id: project.id,
        file_url: signedUrl.signedUrl,
        file_name: fileName,
        file_format: format,
      };
      console.log(`[API /upload-complete] 发送 POST 到: ${VPS_URL}/process-url`, payload);

      const vpsRes = await fetch(`${VPS_URL}/process-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-VPS-Token": VPS_SECRET_TOKEN ?? "" },
        body: JSON.stringify(payload),
      });
      
      if (!vpsRes.ok) {
        console.error(`[API /upload-complete] VPS 收到请求但响应 HTTP ${vpsRes.status}:`, await vpsRes.text());
      } else {
        console.log("[API /upload-complete] VPS 任务分发成功!", await vpsRes.json());
      }
    } catch (e) {
      console.error("[API /upload-complete] fetch 呼叫 VPS 服务直接抛出异常 (网络或超时):", e);
    }
  }

  return NextResponse.json({ success: true, projectId: project.id, modelId: model.id, name });
}
