import { createClient } from "@/lib/supabase/server";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await createClient();
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Apply the signed-in user's RLS policies to the delete as well as the archive read.
  const { data, error } = await db.from("models").delete().eq("id", id).select("project_id").maybeSingle();
  if (error) return Response.json({ error: "删除失败，请稍后重试" }, { status: 500 });
  if (data) {
    const remaining = await db.from("models").select("id", { count: "exact", head: true }).eq("project_id", data.project_id);
    if (!remaining.error && remaining.count === 0) {
      await db.from("projects").delete().eq("id", data.project_id).eq("user_id", user.id);
    }
  }
  return Response.json({ success: true });
}
