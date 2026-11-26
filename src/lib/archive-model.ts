import { createClient } from "@/lib/supabase/server";

export async function archiveModel(id: unknown) {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { failure: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  if (typeof id !== "string" || !/^[\w-]{1,180}$/.test(id)) {
    return { failure: Response.json({ error: "Valid model ID required" }, { status: 400 }) };
  }
  const { data: model } = await client.from("models")
    .select("id, name, audit_json, status, progress, speckle_stream_id, speckle_model_id, projects!inner(user_id)")
    .eq("projects.user_id", user.id).eq("id", id).single();
  if (!model) return { failure: Response.json({ error: "Model not found" }, { status: 404 }) };
  return { client, model };
}

/** Optional, first-party archive worker. Only stored model files are read by these two routes. */
export async function archiveRequest(action: "summary" | "report", modelId: string, fileName = "") {
  const base = process.env.NEXT_PUBLIC_VPS_API_URL;
  const token = process.env.VPS_SECRET_TOKEN;
  if (!base || !token) return null;
  const path = action === "summary" ? "/project/" + encodeURIComponent(modelId) + "/summary" : "/compliance-check";
  return fetch(base.replace(/\/+$/, "") + path, {
    method: action === "summary" ? "GET" : "POST",
    headers: { "Content-Type": "application/json", "X-VPS-Token": token },
    body: action === "report" ? JSON.stringify({ model_id: modelId, file_name: fileName }) : undefined,
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(action === "summary" ? 5000 : 60000),
  });
}

export const archiveHeaders = { headers: { "Cache-Control": "private, no-store" } };
