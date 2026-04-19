import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 使用具有删除权限的 Admin Client
  const adminClient = createAdminClient();

  // 先确认项目属于当前用户
  const { error } = await adminClient
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Project delete error:", error);
    return NextResponse.json({ error: "删除失败，请稍后重试" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
