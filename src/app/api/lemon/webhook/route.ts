// ================================================================
//  API Route: /api/lemon/webhook — Lemon Squeezy 支付回调
//  处理 order_created / subscription_created 事件，更新用户 plan
//  在 Lemon Squeezy Dashboard → Settings → Webhooks 中配置此 URL
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

const WEBHOOK_SECRET = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET ?? "";

/**
 * 验证 Lemon Squeezy Webhook 签名
 * 使用 HMAC-SHA256 校验 X-Signature 请求头
 */
function verifySignature(rawBody: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) return false;
  const hash = crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature") ?? "";

  if (!verifySignature(rawBody, signature)) {
    console.error("[Webhook] Signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventName = (payload.meta as Record<string, unknown>)?.event_name as string;
  console.log("[Webhook] Event:", eventName);

  // 仅处理成功付款事件
  if (!["order_created", "subscription_created", "subscription_updated"].includes(eventName)) {
    return NextResponse.json({ received: true });
  }

  try {
    const data = (payload.data as Record<string, unknown>)?.attributes as Record<string, unknown>;
    const customData = (payload.meta as Record<string, unknown>)?.custom_data as Record<string, unknown> ?? {};

    // 优先从 custom_data 读取 user_id（通过 checkout URL 参数传入）
    const userId = (customData.user_id as string) ?? "";
    const customerEmail = (data?.user_email as string) ?? "";

    const supabase = await createClient();

    if (userId) {
      // 直接通过 user_id 更新
      await supabase
        .from("profiles")
        .update({ plan: "PRO" })
        .eq("id", userId);
      console.log("[Webhook] Updated plan for userId:", userId);
    } else if (customerEmail) {
      // 回退：通过 email 匹配
      await supabase
        .from("profiles")
        .update({ plan: "PRO" })
        .eq("email", customerEmail);
      console.log("[Webhook] Updated plan for email:", customerEmail);
    } else {
      console.warn("[Webhook] No user_id or email in payload");
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[Webhook] Processing error:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
