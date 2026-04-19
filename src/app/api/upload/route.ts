// ================================================================
//  API Route: /api/upload — 接收 IFC/RVT/FBX 文件
//  鉴权 → 校验 → Supabase Storage → 创建 DB 记录 → 触发 VPS 解析
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB
// NOTE: Speckle 云端自带 IFCOpenShell / ODA / OCCT 等多格式解析引擎，此处放开全部主流 3D/BIM 格式
const ALLOWED_EXTS = [
  "ifc", "rvt", "dwg", "dxf", "3dm", "step", "stp", "iges", "igs",
  "e57", "skp", "nwd", "nwc", "fbx", "obj", "glb", "gltf",
  "3mf", "3ds", "amf", "x", "dgn", "ply", "sldprt", "stl",
] as const;

const EXT_TO_FORMAT: Record<string, string> = {
  ifc: "IFC", rvt: "RVT", dwg: "DWG", dxf: "DXF",
  "3dm": "3DM", step: "STEP", stp: "STEP", iges: "IGES", igs: "IGES",
  e57: "E57", skp: "SKP", nwd: "NWD", nwc: "NWC",
  fbx: "FBX", obj: "OBJ", glb: "GLB", gltf: "GLTF",
  "3mf": "3MF", "3ds": "3DS", amf: "AMF", x: "DirectX",
  dgn: "DGN", ply: "PLY", sldprt: "SLDPRT", stl: "STL",
};
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
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const projectName = (formData.get("projectName") as string | null)?.trim();

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // ── 3. 服务端文件校验 ─────────────────────────────────────────
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: `文件过大，最大支持 200 MB（当前 ${(file.size / 1024 / 1024).toFixed(1)} MB）` },
      { status: 400 }
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTS.includes(ext as typeof ALLOWED_EXTS[number])) {
    return NextResponse.json(
      { error: `不支持的文件格式 .${ext}，仅支持：${ALLOWED_EXTS.join(", ")}` },
      { status: 400 }
    );
  }

  const format = EXT_TO_FORMAT[ext];

  // ── 4. 上传到 Supabase Storage ───────────────────────────────
  const storagePath = `${user.id}/${Date.now()}_${file.name}`;
  const bytes = await file.arrayBuffer();

  const { error: storageErr } = await supabase.storage
    .from("bim-models")
    .upload(storagePath, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (storageErr) {
    console.error("Storage upload error:", storageErr);
    return NextResponse.json({ error: "文件存储失败，请重试" }, { status: 500 });
  }

  // ── 5. 创建 Supabase DB 记录 ──────────────────────────────────
  const name = projectName || file.name.replace(/\.[^.]+$/, "");

  const { data: project, error: projErr } = await supabase
    .from("projects")
    .insert({ user_id: user.id, name, description: "" })
    .select("id")
    .single();

  if (projErr || !project) {
    console.error("Project insert error:", projErr);
    return NextResponse.json({ error: "创建项目失败" }, { status: 500 });
  }

  const { data: model, error: modelErr } = await supabase
    .from("models")
    .insert({
      project_id: project.id,
      name: file.name,
      file_type: format,
      file_url: storagePath,
      status: "PARSING",
      progress: 5,
      element_count: 0,
    })
    .select("id")
    .single();

  if (modelErr || !model) {
    console.error("Model insert error:", modelErr);
    return NextResponse.json({ error: "创建模型记录失败" }, { status: 500 });
  }

  // ── 6. 生成签名 URL 供 VPS 下载（1 小时有效）────────────────────
  const { data: signedUrl } = await supabase.storage
    .from("bim-models")
    .createSignedUrl(storagePath, 3600);

  if (signedUrl?.signedUrl) {
    // fire-and-forget，不阻塞响应
    fetch(`${VPS_URL}/process-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-VPS-Token": VPS_SECRET_TOKEN ?? "" },
      body: JSON.stringify({
        model_id: model.id,
        project_id: project.id,
        file_url: signedUrl.signedUrl,
        file_name: file.name,
        file_format: format,
      }),
    }).catch((e) => console.error("VPS trigger failed:", e));
  }

  return NextResponse.json({
    success: true,
    projectId: project.id,
    modelId: model.id,
    name,
    format,
  });
}
