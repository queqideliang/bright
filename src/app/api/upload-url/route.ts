// ================================================================
//  API Route: /api/upload-url
//  鉴权 + 校验文件信息 → 返回 Supabase Storage 签名上传 URL
//  文件由浏览器直接 PUT 到 Supabase，绕过 Next.js 大小限制
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const MAX_SIZE_BYTES = 200 * 1024 * 1024;
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

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fileName, fileSize } = await request.json();

  if (!fileName || !fileSize) {
    return NextResponse.json({ error: "fileName and fileSize required" }, { status: 400 });
  }

  if (fileSize > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: `文件过大，最大支持 200 MB（当前 ${(fileSize / 1024 / 1024).toFixed(1)} MB）` },
      { status: 400 }
    );
  }

  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTS.includes(ext as typeof ALLOWED_EXTS[number])) {
    return NextResponse.json({ error: `不支持 .${ext} 格式` }, { status: 400 });
  }

  const storagePath = `${user.id}/${Date.now()}_${fileName}`;
  const format = EXT_TO_FORMAT[ext];

  // 生成签名上传 URL（用 service role，绕过 RLS）
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("bim-models")
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    console.error("Signed URL error:", error);
    return NextResponse.json({ error: "无法生成上传链接" }, { status: 500 });
  }

  return NextResponse.json({
    signedUrl: data.signedUrl,
    storagePath,
    format,
  });
}
