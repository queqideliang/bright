// ================================================================
//  API Route: /api/projects — 获取当前用户的项目和模型列表
// ================================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 查询用户的项目及其包含的模型
    const { data: projects, error } = await supabase
      .from("projects")
      .select(`
        id, name, description, created_at,
        models (
          id, name, file_type, speckle_stream_id, speckle_model_id,
          status, progress, element_count, created_at, updated_at,
          import_job_id, import_status, import_error
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Projects query error:", error);
      return NextResponse.json({ error: "查询失败，请稍后重试" }, { status: 500 });
    }

    // 计算聚合统计
    const allModels = projects?.flatMap((p) => p.models ?? []) ?? [];
    const stats = {
      totalProjects: projects?.length ?? 0,
      totalElements: allModels.reduce((sum, m) => sum + (m.element_count || 0), 0),
      auditsDone: allModels.filter((m) => m.status === "COMPLETED").length,
      completeness: allModels.length > 0
        ? Math.round((allModels.filter((m) => m.status === "COMPLETED").length / allModels.length) * 100)
        : 0,
    };

    return NextResponse.json({ projects: projects ?? [], stats });
  } catch (err) {
    console.error("Projects API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
