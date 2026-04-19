import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const SPECKLE_TOKEN = process.env.SPECKLE_TOKEN;
const SPECKLE_GQL = "https://app.speckle.systems/graphql";

async function deleteSpeckleModel(projectId: string, modelId: string) {
  if (!projectId || !modelId || modelId === "all") return;
  try {
    console.log(`[DELETE API] Requesting Speckle delete for project ${projectId}, model ${modelId}`);
    await fetch(SPECKLE_GQL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SPECKLE_TOKEN}`,
      },
      body: JSON.stringify({
        query: `mutation DeleteModel($input: DeleteModelInput!) {
          modelMutations { delete(input: $input) }
        }`,
        variables: { input: { id: modelId, projectId } },
      }),
      signal: AbortSignal.timeout(10000),
    });
    console.log("[DELETE API] Speckle model deleted successfully");
  } catch (e) {
    console.warn("⚠️ Speckle 模型删除失败（忽略）:", e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    console.log(`[DELETE API] Received delete request for model ID: ${id}`);
    
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log(`[DELETE API] Auth failed:`, authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log(`[DELETE API] User authenticated: ${user.id}`);

    const adminClient = createAdminClient();

    const { data: model, error: selectError } = await adminClient
      .from("models")
      .select("project_id, speckle_stream_id, speckle_model_id")
      .eq("id", id)
      .single();
      
    if (selectError) {
      console.log(`[DELETE API] Select model error:`, selectError);
    } else {
      console.log(`[DELETE API] Model data retrieved:`, model);
    }

    if (model?.speckle_stream_id && model?.speckle_model_id) {
      await deleteSpeckleModel(model.speckle_stream_id, model.speckle_model_id);
    }

    const { error } = await adminClient.from("models").delete().eq("id", id);
    if (error) {
      console.error("[DELETE API] ❌ 模型删除失败:", error.message);
      return NextResponse.json({ error: "删除失败，请稍后重试" }, { status: 500 });
    }
    console.log(`[DELETE API] Model removed from Supabase`);

    if (model?.project_id) {
      const { count } = await adminClient
        .from("models")
        .select("id", { count: "exact", head: true })
        .eq("project_id", model.project_id);
        
      console.log(`[DELETE API] Remaining models for project ${model.project_id}: ${count}`);

      if (count === 0) {
        const { error: pError } = await adminClient.from("projects").delete()
          .eq("id", model.project_id)
          .eq("user_id", user.id);
        if (pError) console.log(`[DELETE API] Error cascade deleting project:`, pError);
        else console.log(`[DELETE API] Empty project removed`);
      }
    }

    console.log(`[DELETE API] Model ID ${id} deleted perfectly.`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.log(`[DELETE API] Unhandled Exception:`, err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
